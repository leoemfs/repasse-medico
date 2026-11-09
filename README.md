# Repasse Médico v2 (alpha)

Aplicação local, em um único HTML, para conferir o repasse médico: relatório do MV (PDF) × laudos do Apolo (xlsx), com base de equivalências TUSS validada e identificação de prestador. Especificação: documentação v1.6 (RN-178 a RN-215).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `src/engine/` | Motor sem interface: leitura do MV, xlsx, Apolo/Power BI, configuração, equivalências, conferência, correção de prestador, rodadas e relatórios |
| `src/ui/` | Telas: início, fluxo mensal, conferência, correção, não conformidades, fechamento, equivalências, bases, rodadas e configurações |
| `src/index.html`, `src/styles.css` | Modelo da página |
| `lib/` | pdf.js 4 (legacy) e JSZip 3.10.1, embutidos em base64 no build |
| `tools/build.mjs` | Gera `dist/Repasse_Medico_v<versão>.html` |
| `test/` | `motor.mjs` (motor no Chromium), `e2e.mjs` (ponta a ponta, por file://) `menu.mjs` (navegação), `fluxo.mjs` (fluxo mensal), `nc.mjs` (não conformidades), `competencia.mjs` (competência no topo) e `calendario.mjs` (dias úteis) |
| `docs/` | Especificações, requisitos em levantamento e guias de uso |
| `dados/` | Arquivos reais para teste. **Fora do Git** (dados de pacientes) |

## Comandos

```bash
node tools/build.mjs            # gera o HTML final em dist/
node tools/build.mjs --harness  # gera dist/harness.html para test/motor.mjs
node test/motor.mjs             # motor com os arquivos de dados/
node test/e2e.mjs               # interface completa com os arquivos de dados/
node test/menu.mjs              # menu recolhível, Ctrl+B e barra do celular
node test/fluxo.mjs             # fluxo mensal (com data fixa em 29/10/2026)
node test/nc.mjs                # não conformidades com os arquivos de dados/ (data fixa em 30/10/2026)
node test/competencia.mjs       # competência no topo, encapsulamento, fechar/reabrir (data fixa em 30/10/2026)
node test/decisoes.mjs          # desfazer conflito e memória das decisões por linha
node test/regras.mjs            # regras de repasse em Bases e importação da planilha de controle
node test/fechamento.mjs        # aba Fechamento: valores com aceite, situação, prévia do e-mail e exportação
node test/arquivos.mjs          # arquivos da sessão: genérico na correção, limpar, outra produção
node test/correcao_excel.mjs    # Excel da correção de prestador (aba «Corrigir no MV»)
node test/busca.mjs             # campo de busca no cadastro (NCs)
node test/v3.mjs                # regras da V3 (Curitiba): cálculo, e-mail, fechamento, exportação e HM na conferência
node test/descontos.mjs         # descontos parcelados: parcela automática, alertas, adiar e exportação
node test/aceite_cobertura.mjs  # aceite na Conferência (F11) e cobertura/validação em lote (F15)
node test/fluxo_dados.mjs       # candidatos a NC guardados (F17) e Fluxo ligado aos dados (F14, F13, F16)
node test/compostas.mjs         # regras compostas e por convênio (F5 v2: títulos, palavras, quantidade, exceção por convênio, fusão por %)
node test/prestadores_unidade.mjs # prestadores por unidade (SOL-F35) com a competência 10/2026 real
node test/conferencia_causas.mjs # conferência por causa: o que falta decidir, validar e conferir de novo, Excel (comp. 10/2026 real)
node test/conferencia_lote.mjs  # vários PDFs do mesmo prestador: filtro por unidade e grupo e conferência em lote (comp. 10/2026 real)
node test/pasta_raiz.mjs        # pasta raiz na rede: criar pastas, ler PDFs e planilhas, sincronizar equivalências (SOL-F37/F38)
node test/fluxo_sync.mjs        # Fluxo sincronizado pela pasta da rede com dois usuários e divisão das unidades (SOL-F36)
node test/compostas_comp10.mjs  # regras compostas na competência 10/2026 real: simulação × efetividade e cobertura
node test/eq_uso.mjs            # uso das equivalências nas conferências: em uso, paradas, nunca usadas e impacto antes de tirar a validação
node test/conciliacao.mjs       # conciliação com o Power BI (F9)
node test/planilhas_guardadas.mjs # planilhas de laudos e do Power BI guardadas por competência
node test/competencia10.mjs     # competência 10/2026 inteira com os arquivos reais (dados/comp_10-2026)
node test/calendario.mjs        # dias úteis, feriados nacionais e marcos (Node puro)
```

## Publicação (GitHub Pages)

A ferramenta fica em **https://leoemfs.github.io/repasse-medico/**, sempre na última versão lançada. Ela roda inteira no navegador: o site só entrega a página, e os arquivos de pacientes nunca saem do computador.

- **Lançar uma versão:** subir `MOTOR_VERSAO`, gerar o `dist/`, commitar e acrescentar a versão no topo de `publicacao/versoes.json` (versão, commit e data). Enviar isso à `main` dispara `.github/workflows/pages.yml`, que monta o site com `tools/site-pages.mjs`.
- Commits que não mexem em `publicacao/versoes.json` não mudam o site, e versões em teste não aparecem nele.
- **Versões anteriores:** https://leoemfs.github.io/repasse-medico/versoes/ lista só as da linha 2.1.0-alpha, para baixar e abrir do computador.
- **Dados:** o navegador guarda os dados separados por endereço. Para passar do arquivo local para o site, use Configurações → «Exportar backup» no arquivo e «Restaurar backup» no site.

## Regras de desenvolvimento

1. Regra de negócio só em `src/engine/`; as telas apenas chamam o motor.
2. Toda mudança começa como solicitação com critério de aceite; o teste entra junto.
3. Uma versão por vez; `MOTOR_VERSAO` em `src/engine/00-util.js` sobe a cada entrega.
4. Antes de entregar: `motor.mjs` e `e2e.mjs` sem erros, Excels reabertos e totais reconciliados.
