// src/index.js (最终无依赖版本)

// 模块作用域内的缓存变量
let envCache = null;

// 将原本的路由处理函数变为独立的 async 函数
async function handleAboutRequest(request, env) {
  const aboutInfo = envCache?.ABOUT_INFO || '<p>关于信息未配置。</p>';
  return new Response(aboutInfo, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleAiMoveRequest(request, env) {
  try {
    // 检查请求方法是否为 POST
    if (request.method !== 'POST') {
        return new Response('Expected POST method', { status: 405 });
    }
    
    const { boardState, moveHistory, aiModel, playerColor } = await request.json();

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '服务端错误: GEMINI_API_KEY 未配置' }), { status: 500 });
    }

    const modelId = env[aiModel] || env.INTERMEDIATE_MODEL;
    if (!modelId) {
      return new Response(JSON.stringify({ error: `服务端错误: AI 模型 ${aiModel} 未配置` }), { status: 500 });
    }

    const boardString = boardState.map(row => 
        row.map(cell => {
            if (cell === 1) return 'X'; // 黑棋
            if (cell === 2) return 'O'; // 白棋
            return '.'; // 空位
        }).join(' ')
    ).join('\n');

    const aiPlayerChar = playerColor === 1 ? 'X (黑棋)' : 'O (白棋)';

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
    const responseText = geminiData.candidates[0].content.parts[0].text;
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
}

// 这是 Worker 的主入口
export default {
  async fetch(request, env, ctx) {
    // 初始化缓存
    if (!envCache) {
        console.log("Initializing environment variable cache for this Worker instance...");
        envCache = {
            ABOUT_INFO: env.ABOUT_INFO,
            FILENAME_SUFFIX: env.FILENAME_SUFFIX,
        };
    }

    // 从请求中获取URL路径
    const url = new URL(request.url);
    const path = url.pathname;

    // 手动实现路由逻辑
    try {
        if (request.method === 'GET' && path === '/api/about') {
            return handleAboutRequest(request, env);
        }
        
        if (request.method === 'POST' && path === '/api/get-ai-move') {
            return handleAiMoveRequest(request, env);
        }
        
        // 如果没有匹配的 API 路由，返回 404
        // 注意：对于配置了 [site] 的 Worker 或 Pages+Functions 的项目，
        // 静态文件请求由平台自动处理，通常不会进入这部分代码。
        return new Response('API Endpoint Not Found.', { status: 404 });
    
    } catch (err) {
        // 基本的错误处理
        console.error(err);
        return new Response('Something went wrong', { status: 500 });
    }
  },
};
