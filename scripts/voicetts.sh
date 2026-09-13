#!/bin/bash
# OmniVoice TTS 客户端 — 配合 asn-podcast 使用
# 用法: ./voicetts.sh "你好世界" [output.wav]

TEXT="${1:-你好，这是一个测试。}"
OUT="${2:-output.wav}"
API="${OMNIVOICE_URL:-https://colab-locks-gradio.git4ta.fun}"

echo "📡 $API  →  $OUT"

RESP=$(curl -s -X POST "$API/gradio_api/api/_design_fn" \
  -H "Content-Type: application/json" \
  -d '{
    "data": ["'"$TEXT"'", "Auto", 25, 4, true, 1.0, 5, true, true,
             "Female / 女", "Young Adult / 青年",
             "Moderate Pitch / 中音调", "Auto", "Auto", "Auto"]
  }')

AUDIO_PATH=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['path'])" 2>/dev/null)
[ -z "$AUDIO_PATH" ] && echo "❌ API error: $RESP" && exit 1

curl -s -o "$OUT" "$API/gradio_api/file=$AUDIO_PATH"
echo "✅ $(du -h "$OUT" | cut -f1)  —  $OUT"
