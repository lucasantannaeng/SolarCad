
# Importação via PDF (Datasheet OCR) — Pronto para build

Implementação aprovada com ajuste de UX (linhas em modo somente-leitura + botão de edição inline). Mudar para build mode para aplicar os arquivos abaixo.

## 1. `supabase/functions/process-datasheet/index.ts` (novo)

- CORS via `npm:@supabase/supabase-js@2/cors`.
- Zod valida o body: `{ fileBase64: string, fileName?: string, hint?: 'module'|'inverter'|'auto' }`.
- Limita base64 a ~10 MB (`fileBase64.length`).
- Chama Lovable AI Gateway (`google/gemini-2.5-flash`) com bloco `{type:"file", file:{filename, file_data:"data:application/pdf;base64,..."}}` + system prompt exigindo JSON estrito.
- Trata 429 e 402 repassando o status com mensagem.
- Faz `JSON.parse` (removendo cercas ```json) e valida com `ResultSchema` (Zod) — falha → 500 com `details`.
- Regra para a IA: se um campo numérico não consta no PDF, retorne `0`; nunca omita chaves; múltiplos modelos viram múltiplos itens.

## 2. `src/pages/admin/DatasheetImportModal.tsx` (novo)

Props: `{ open, onOpenChange, kind: 'module'|'inverter', onImported }`.

Estados: `step: 'upload'|'loading'|'review'|'saving'`, `file`, `modules`, `inverters`, `selectedModules/Inverters` (Set), `editingModuleIdx`, `editingInverterIdx`.

- **Upload**: drag & drop + `<input type="file" accept="application/pdf">`, valida extensão e 10 MB.
- Converte para base64 e chama `supabase.functions.invoke('process-datasheet', { body: { fileBase64, fileName, hint: kind } })`.
- **Loading**: spinner.
- **Review**: tabelas (`Módulos` e/ou `Inversores`) com:
  - Checkbox de seleção por linha (pré-marcadas para o `kind` do contexto).
  - **Valores como texto somente-leitura por padrão.**
  - Botão de lápis ("Editar") na coluna Ações → troca a linha inteira para `<Input>` (modo edição inline) com botões Check/X para confirmar.
- Validação client-side antes de salvar (brand/model não vazios, numéricos > 0, `mppt_max > mppt_min`, `output_phases ∈ {1,2,3}`).
- Bulk insert separado em `modules` e `inverters`. Toast de sucesso, `onImported()`, fecha modal.

## 3. Integração nos Managers

`src/pages/admin/ModuleManager.tsx` e `src/pages/admin/InverterManager.tsx`:

- Importar `Upload` (lucide) e `DatasheetImportModal`.
- Adicionar estado `importOpen`.
- Header passa a usar `flex gap-2`, com botão `<Button variant="outline">Importar PDF</Button>` ao lado do "Adicionar".
- Renderizar `<DatasheetImportModal open kind onImported={fetchX} />`.

## Arquivos afetados

- **Novo**: `supabase/functions/process-datasheet/index.ts`
- **Novo**: `src/pages/admin/DatasheetImportModal.tsx`
- **Editado**: `src/pages/admin/ModuleManager.tsx`
- **Editado**: `src/pages/admin/InverterManager.tsx`
