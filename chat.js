// Serverless proxy for the portfolio chat widget.
// Keeps the Groq API key server-side — never sent to the browser.
//
// Deploy on Vercel: this file at /api/chat.js is auto-detected as a serverless function.
// Set GROQ_API_KEY in your Vercel project's Environment Variables (Settings > Environment Variables).
// Get a free key at https://console.groq.com — no credit card required.
// Free tier: 30 requests/min, 1,000 requests/day — more than enough for a portfolio site.

const SYSTEM_PROMPT = `You are a helpful assistant embedded in Utkarsh Shrivastava's personal portfolio website.
Answer questions about Utkarsh factually, in third person, using ONLY the information below.
Keep answers concise — 2 to 4 sentences, no markdown formatting, plain conversational text.
If asked something outside this scope (general coding help, unrelated topics, opinions, requests to do someone's homework, etc.),
politely redirect the person to ask about Utkarsh's background, projects, or to use the contact form on the site.
Never invent details that are not listed here. If you don't know something, say so and point to the contact form.

ABOUT: Utkarsh Shrivastava, pre-final year B.Tech Information Technology student at Manipal University Jaipur, based in Jaipur, Rajasthan.

EXPERIENCE: Frontend Developer Intern at Thriftz — built React.js e-commerce interfaces, REST API integration
(auth, product filtering, order creation), and performance optimizations (code splitting, lazy loading) that
measurably improved Core Web Vitals.

PROJECTS:
- MedFusion-AI: a multi-modal RAG system unifying medical research papers, radiology scans, diagnostic reports,
  and anatomical diagrams into one retrieval framework. Hybrid semantic retrieval with vector embeddings and
  cross-modal indexing improved retrieval accuracy by 30% and cut hallucinations by 25% versus a text-only RAG
  baseline. Repo: github.com/Utkarsh809/MedFusion-AI
- Vexta-AI: an AI-powered document research assistant for real-time PDF upload and natural-language conversation.
  Built with Streamlit, TensorFlow, and MCP; integrates the PageIndex API with Claude for hierarchical document
  indexing and context-aware retrieval. Repo: github.com/Utkarsh809/Vexta-AI

TECH STACK: Languages — Java, JavaScript, Python. Frameworks — React.js, Next.js, Express.js, Node.js.
Databases & Tools — MongoDB, Firebase, PostgreSQL, Git. AI/ML — NumPy, Pandas, TensorFlow, Scikit-learn,
Hugging Face, RAG.

LEADERSHIP: Treasurer of the ACM SIGAI Student Chapter at Manipal University Jaipur since Nov 2024 — leads a
20-person finance team and co-organized the Elicit symposium (10+ events, 15,000+ participants). Also a Google
Student Ambassador (Campus Lead, Aug 2025–Feb 2026) — ran a GenAI & Prompt Engineering workshop and 5+ technical
sessions for 500+ attendees.

ACHIEVEMENTS: Finalist at the Hacks 10.0 Hackathon (top 20 of 200+ teams), building Agro-AI, a machine-learning
platform analyzing soil patterns for crop yield prediction. Also received the Student Excellence Award from
Manipal University Jaipur for academic merit, leadership, and peer mentoring.

COMPETITIVE PROGRAMMING: Active on LeetCode.

CONTACT: Direct people to the contact form on the site, or the email/GitHub/LinkedIn links in the Contact section.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body || {};

  if (typeof message !== 'string' || !message.trim() || message.length > 500) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Only trust role/content, cap history length, and hard-cap total payload size
  const safeHistory = Array.isArray(history)
    ? history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content.slice(0, 500) }))
    : [];

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...safeHistory,
          { role: 'user', content: message.trim() }
        ]
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('Groq API error:', upstream.status, errText);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Empty response from model' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
