// src/index.js

import { Router } from 'itty-router';
import { Toucan } from 'toucan-js';

// 在模块作用域内定义缓存变量
let envCache = null;

const router = Router();

/**
 * API路由：获取“关于”信息
 */
router.get('/api/about', (request, env) => {
  // 从缓存中读取ABOUT_INFO
  const aboutInfo = envCache?.ABOUT_INFO || '<p>关于信息未配置。</p>';
  return new Response(aboutInfo, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

/**
 * API路由：获取AI的下一步棋 (真实实现)
 */
router.post('/api/get-ai-move', async (request, env) => {
  try {
    const { boardState, moveHistory, aiModel, playerColor } = await request.json();

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '服务端错误: GEMINI_API_KEY 未配置' }), { status: 500 });
    }

    const modelId = env[aiModel] || env.INTERMEDIATE_MODEL;
    if (!modelId) {
      return new Response(JSON.stringify({ error: `服务端错误: AI 模型 ${aiModel} 未配置` }), { status: 500 });
    }

    // 将棋盘转换为AI易于理解的文本格式
    const boardString = boardState.map(row => 
        row.map(cell => {
            if (cell === 1) return 'X'; // 黑棋
            if (cell === 2) return 'O'; // 白棋
            return '.'; // 空位
        }).join(' ')
    ).join('\n');

    const aiPlayerChar = playerColor === 1 ? 'X (黑棋)' : 'O (白棋)';

    // 为 Gemini精心设计的提示词 (Prompt)
    const prompt = `
      你是一位五子棋（Gobang/Five-in-a-Row）世界顶尖高手。
      规则：棋盘为 15x15，坐标从 0 到 14。'X' 代表黑棋，'O' 代表白棋，'.' 代表空位。率先在水平、垂直或对角线上连成五个己方棋子者获胜。
      
      当前棋盘局势如下:
      ${boardString}

      现在轮到你 (${aiPlayerChar}) 落子。
      请根据当前的局势，计算出最佳的落子位置以确保胜利。
      你必须选择一个当前为 '.' 的空位。
      你的回应必须且只能是一个JSON对象，格式为: {"move": [row, col]}。其中 row 和 col 都是0到14之间的整数。不要包含任何解释、分析或额外的文本。
    `;

    // 调用 Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error("Gemini API Error:", errorBody);
        return new Response(JSON.stringify({ error: `Gemini API 错误: ${geminiResponse.statusText}` }), { status: geminiResponse.status });
    }

    const geminiData = await geminiResponse.json();
    
    // 解析AI的响应
    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // 净化AI返回的文本，移除潜在的markdown代码块标记
    const cleanedText = responseText.replace(/```json|```/g, '').trim();
    
    const moveData = JSON.parse(cleanedText);
    
    if (!moveData.move || !Array.isArray(moveData.move) || moveData.move.length !== 2) {
        throw new Error("AI返回了无效的数据格式。");
    }

    // Gemini 返回的是 [row, col]，对应我们的 [y, x]
    return new Response(JSON.stringify({ move: moveData.move }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI move generation error:', error);
    return new Response(JSON.stringify({ error: `调用AI时发生内部错误: ${error.message}` }), { status: 500 });
  }
});


// 捕获所有其他请求，对于一个配置了 [site] 的 Worker，这主要用于处理 API 404
router.all('*', () => new Response('API Endpoint Not Found.', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    // Worker 实例初始化时，填充缓存
    if (!envCache) {
        console.log("Initializing environment variable cache for this Worker instance...");
        envCache = {
            ABOUT_INFO: env.ABOUT_INFO,
            FILENAME_SUFFIX: env.FILENAME_SUFFIX,
            // 注意: 不缓存机密信息 (secrets)
        };
    }

    const sentry = new Toucan({
        // 可选：用于错误监控的DSN
        // dsn: 'YOUR_SENTRY_DSN',
        context: ctx,
        request: request,
    });

    try {
        return await router.handle(request, env, ctx);
    } catch (err) {
        sentry.captureException(err);
        return new Response('Something went wrong', { status: 500 });
    }
  },
};
