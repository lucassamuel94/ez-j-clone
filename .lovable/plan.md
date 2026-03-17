## Transcrição em massa — correção definitiva (v3)

### Problema original
`transcribe-call` era **síncrono** — esperava o Deepgram terminar a transcrição inteira dentro do mesmo request HTTP. Com áudios de 9-28 min, o edge function dava timeout e nada era concluído.

### Correções aplicadas

1. **`transcribe-call` agora é assíncrono** (igual `transcribe-video`)
   - Envia áudio ao Deepgram com `callback` URL
   - Retorna imediatamente com `status: "processing"`
   - Deepgram envia resultado para `deepgram-webhook?type=sdr`

2. **`bulk-process-queue` processa 1 item por invocação**
   - Busca 1 `queued`, baixa, faz upload, despacha transcrição
   - Retorna em ~5-10s (não espera transcrição terminar)
   - Timeouts explícitos (45s download, 10s login)

3. **`recover-stuck-call-analyses` corrigido**
   - Usa `media_type` para rotear: áudio → `transcribe-call`, vídeo → `transcribe-video`
   - Usa `analysis_context` para rotear: `demo` → `analyze-demo`, `sdr_call` → `analyze-call`

4. **`auto-analyze-calls` corrigido**
   - Payload corrigido: `{ analysis_id, audio_path }` (era `{ analysisId }`)
   - Auth corrigida: usa `serviceKey` (era `anonKey`)

5. **UI (`BulkCallAnalysisPanel`) redesenhada**
   - Mostra contadores separados: fila / transcrevendo / despachadas / erros
   - Não depende da transcrição terminar no mesmo ciclo
   - Botão "Atualizar contadores" para ver progresso background

### Status
✅ Implementado e deployado. 84 chamadas prontas para despacho.
