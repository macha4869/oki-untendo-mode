const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    // 動作確認用
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "OKI Voice Worker",
        status: "ready",
      });
    }

    // ヘルスチェック
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "OKI Voice Worker",
      });
    }

    // 音声文字起こし
    if (request.method === "POST" && url.pathname === "/transcribe") {
      try {
        if (!env.OPENAI_API_KEY) {
          return json(
            {
              ok: false,
              error: "OPENAI_API_KEY が設定されていません",
            },
            500
          );
        }

        const contentType = request.headers.get("content-type") || "";

        if (!contentType.includes("multipart/form-data")) {
          return json(
            {
              ok: false,
              error: "音声ファイルを multipart/form-data で送信してください",
            },
            400
          );
        }

        const formData = await request.formData();
        const audio = formData.get("audio");

        if (!audio || typeof audio === "string") {
          return json(
            {
              ok: false,
              error: "audio ファイルがありません",
            },
            400
          );
        }

        const openaiForm = new FormData();
        openaiForm.append("file", audio, audio.name || "audio.webm");
        openaiForm.append("model", "gpt-4o-mini-transcribe");
        openaiForm.append("language", "ja");

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            },
            body: openaiForm,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          return json(
            {
              ok: false,
              error: result?.error?.message || "文字起こしに失敗しました",
            },
            response.status
          );
        }

        return json({
          ok: true,
          text: result.text || "",
        });
      } catch (error) {
        return json(
          {
            ok: false,
            error: error?.message || "Worker error",
          },
          500
        );
      }
    }

    return json(
      {
        ok: false,
        error: "Not Found",
      },
      404
    );
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}
