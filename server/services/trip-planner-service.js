const fetch = require('node-fetch');
const { normalizeClientPois } = require('../utils/normalize-poi');
const { withResponseMeta } = require('../utils/response-meta');

function cleanEnv(value) {
  if (!value) {
    return '';
  }

  return String(value).trim();
}

function buildFallbackReply(pois, reason) {
  return withResponseMeta(
    {
      reply: pois.length > 0
        ? 'Here are some good nearby stops to start with while the AI planner catches up.'
        : 'I could not find nearby stops just yet, so I am falling back to demo picks.',
      recommendations: pois.slice(0, 3).map((poi) => poi.name)
    },
    {
      source: 'fallback',
      fallback: true,
      reason
    }
  );
}

function createTripPlannerService({ env = process.env, fetchImpl = fetch } = {}) {
  const config = {
    GROQ_API_KEY: cleanEnv(env.GROQ_API_KEY),
    GROQ_MODEL: cleanEnv(env.GROQ_MODEL) || 'llama-3.3-70b-versatile'
  };

  function getHealthStatus() {
    return {
      hasGroqKey: Boolean(config.GROQ_API_KEY),
      groqModel: config.GROQ_MODEL
    };
  }

  async function planTrip({ userMessage, userLat, userLng, availablePois }) {
    const normalizedPois = normalizeClientPois(availablePois, Number(userLat) || 1.285, Number(userLng) || 103.8268);
    if (!config.GROQ_API_KEY) {
      return buildFallbackReply(normalizedPois, 'AI provider is not configured');
    }

    if (!normalizedPois.length) {
      return buildFallbackReply([], 'No candidate POIs were available for trip planning');
    }

    try {
      const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.GROQ_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'You are GoGrab\'s trip planning assistant for tourists in Singapore. Always reply with valid JSON only.'
            },
            {
              role: 'user',
              content: `The user is at coordinates: ${userLat}, ${userLng}.
Available nearby spots: ${JSON.stringify(normalizedPois)}.
Reply warmly in 2 sentences max. Then return EXACTLY 3 POI names from the list above that best match what the user wants as JSON only.
Format: {"reply":"...","recommendations":["POI Name 1","POI Name 2","POI Name 3"]}

User said: ${userMessage}`
            }
          ]
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq chat failed: ${response.status} ${text}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Groq chat returned no message content');
      }

      const parsed = JSON.parse(content);
      const recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 3)
        : normalizedPois.slice(0, 3).map((poi) => poi.name);

      return withResponseMeta(
        {
          reply: parsed.reply || 'Here are some good nearby stops that match your vibe.',
          recommendations
        },
        {
          source: 'ai',
          fallback: false,
          reason: null
        }
      );
    } catch (error) {
      return buildFallbackReply(normalizedPois, error.message);
    }
  }

  return {
    getHealthStatus,
    planTrip
  };
}

module.exports = {
  createTripPlannerService
};
