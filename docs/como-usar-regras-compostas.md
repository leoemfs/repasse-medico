# Como usar: regras compostas, exame e composição incompleta

Vale a partir da v3.0.0-alpha.4.

## 1. Regra composta × exame

| Nome | O que é |
|---|---|
| **Equivalência simples** | 1 título do Apolo = 1 código do MV (1 laudo confirma 1 linha). |
| **Regra composta** | 1 título do Apolo = **várias** linhas na conta. Ex.: «USG de bolsa escrotal com Doppler» = 40901203 (órgãos e estruturas) **+** 40901386 (Doppler). |
| **Exame** | Os laudos do **mesmo paciente, no mesmo dia, mesma modalidade e mesmo médico**. Quando um deles fecha uma regra composta, a regra é cumprida pelo **exame inteiro**: o 2º laudo (ex.: a página só do Doppler) não disputa as linhas com o 1º. |

Ou seja: a **regra** diz o que a conta deve ter, e o **exame** junta as páginas do mesmo atendimento para cumprir a regra. Você não cadastra «exames»: a ferramenta monta sozinha a partir da planilha do Apolo.

## 2. Para que servem as regras compostas

Na USG, o Doppler acompanha o exame base. O mesmo exame aparece de dois jeitos no Apolo:

| Como veio no Apolo | Como a conta do MV deve estar |
|---|---|
| **1 laudo:** «Ultrassonografia de bolsa escrotal com Doppler» | 1× 40901203 + 1× 40901386 |
| **2 laudos (duas páginas):** «Ultrassonografia de bolsa escrotal com Doppler» + «Doppler de órgãos e estruturas» (ou «Doppler de bolsa escrotal») | as mesmas 2 linhas: 1× 40901203 + 1× 40901386 |

Com uma regra composta para «… com Doppler», os dois jeitos conferem. No segundo, a 2ª página aparece como **«mesmo estudo»** (conferida), sem virar «Só no laudo».

## 3. Os dois tipos de regra

| Tipo | Quando usar | Como a conferência lê |
|---|---|---|
| **Juntos** | o exame gera **todas** as linhas (base + Doppler) | o exame confirma uma linha de **cada** código; se faltar uma → *Composição incompleta* |
| **Um ou outro** | o exame pode ser lançado com o código A **ou** com o B | o exame confirma **uma** linha, com qualquer um dos códigos |

## 4. Cadastrar uma regra (Equivalências → Regras compostas → «Nova regra»)

1. **«Quando o laudo do Apolo tiver o título…»**
   - Escolha o título, ou mais de um quando forem grafias do mesmo exame.
   - Ex.: «ULTRASSONOGRAFIA DE BOLSA ESCROTAL COM DOPPLER».
2. **«…a conta do MV deve ter:»**
   - Escolha os códigos e marque *Todos* (juntos) ou *Um destes* (um ou outro).
   - Em «juntos», ajuste quantas vezes cada código entra (ex.: mamas + Doppler ×2).
3. **Exceção por convênio** (opcional):
   - Em um convênio, um código pode ser «não exigido» ou ter outra quantidade.
   - Ex.: na UNIMED, mamas com Doppler exige Doppler ×1.
4. **Outros laudos do mesmo exame** (opcional):
   - Títulos que às vezes vêm como 2ª página. Ex.: «DOPPLER DE BOLSA ESCROTAL».
   - Se o título da 2ª página já tem equivalência validada para um código da regra (ex.: «Doppler de órgãos e estruturas» → 40901386), ele entra no exame **automaticamente**. Não precisa colocar aqui.

O quadro **«Como vai funcionar»** escreve a regra em português enquanto você preenche. Leia antes de salvar. Só regra **validada** vale na conferência.

Também dá para criar pela aba **Títulos do Apolo**: escolha o título, marque os dois procedimentos e clique em **«Juntos — regra composta…»**.

## 5. O que aparece na conferência

| Situação | O que significa | O que fazer |
|---|---|---|
| **Conferido** (marcador *Regra composta*) | o exame tem todas as linhas esperadas | nada |
| **Conferido** (marcador *Laudo do mesmo estudo*) | 2ª página de um exame já lançado pela regra | nada |
| **Conferido com ressalva** + **Composição incompleta** | o exame casou com a regra, mas **falta** no MV um código esperado. O motivo diz qual: «falta Doppler (esperado ×1, lançado ×0)» | ver o item 6 |
| **Só no faturamento** + **Procedimento diverge** | código que **não faz parte** da regra para aquele convênio (sobra). Ex.: articular lançado na UNIMED | NC (cobrança indevida) ou corrigir a regra |
| **Só no laudo** + **Pode ser o mesmo estudo** | outro laudo do mesmo paciente e dia, que a ferramenta não sabe se é parte do exame (título desconhecido, ou **outro médico**) | «É o mesmo exame (incluir na regra)», «Dispensar só este…» ou «Não é → NC» |
| **Pendente / ambíguo** | dois laudos podem sustentar a mesma linha e a ferramenta não decide sozinha (ex.: o Doppler laudado por **outro médico** no mesmo dia) | abrir a linha, ver os candidatos e decidir: NC, considerar no repasse ou correção de prestador |

## 6. Como lidar com «Composição incompleta»

Primeiro pergunte: **o exame realmente gera todos esses códigos?**

| Resposta | Ação em «O que falta decidir» |
|---|---|
| Sim, e o MV esqueceu de lançar um | **«Registrar NC do que falta»** (não lançado) |
| Não: esse exame é lançado com **um ou outro** código | **«Tornar a regra alternante (um ou outro) e conferir de novo»** — corrige para todos os próximos |
| Neste caso está certo assim | **«Considerar no repasse»**, com justificativa |
| Sempre falta no mesmo convênio | edite a regra → passo 3, exceção por convênio «não exigido» |

**Regra de bolso:**
- A **mesma** composição incompleta em **muitos** pacientes → quase sempre é a **regra** que está errada: corrija a regra.
- Em **um ou outro** paciente → quase sempre é **lançamento**: registre NC.

Antes da v3.0.0-alpha.4, a 2ª página com equivalência própria podia «roubar» a linha do Doppler. O resultado era uma «Composição incompleta» falsa ou um «ambíguo». Agora o exame resolve isso. Se você tinha essas pendências, **rode a conferência de novo**.

## 7. Dispensar um laudo sem correspondência

Um laudo **«Só no laudo»** que não precisa de lançamento pode ser **dispensado**, como você faz o aceite de uma ressalva. Exemplos:
- 2ª página de um exame já lançado;
- laudo refeito ou retificado;
- exame sem cobrança;
- laudo de outra competência.

- **Uma linha:** abra a linha → **«Dispensar laudo…»** → escolha o motivo (ou «Outro» e escreva).
- **Várias:** em «O que falta decidir», no grupo de «Só no laudo», clique **«Dispensar…»**: vale para todas as linhas do grupo.
- **O que acontece com o laudo dispensado:**
  - sai de «só o que falta decidir»;
  - aparece no marcador **«Laudo dispensado»** e na coluna «Decisão na competência» do Excel;
  - vale para toda nova rodada da competência;
  - **não** vira NC e **não** entra no repasse.
- **Desfazer:** na linha, **«Remover decisão»**.

Dispensar é para quando **não deveria haver lançamento**. Se deveria haver e não há, é **NC** (não lançado) ou **correção de prestador** (lançado para outro médico).
