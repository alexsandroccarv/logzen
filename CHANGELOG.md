# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Added
- Livros: busca passa a tentar a **Google Books** primeiro (com a Open
  Library como segunda fonte, quando a primeira não encontra) e aceita
  **ISBN** (10 ou 13 dígitos, com ou sem hífen) além de título — o
  mesmo campo detecta automaticamente qual é o caso (issue #25).
- Livros: Google Books API como segunda fonte de busca — quando a Open
  Library não encontra o título (comum para livros indies/menos
  conhecidos), cai automaticamente para o Google Books (também
  gratuito, sem chave), com aviso na tela de que o resultado veio de
  lá (issue #24).
- Itens rastreados: novo tipo de item **Horário** (início e fim, ex.:
  "Horário de sono"), com dois campos de hora na tela "Hoje", editáveis
  a qualquer momento — segue o mesmo padrão de nota por item já usado
  nos demais tipos (issue #23).
- Backlog: o campo "Projeto" virou um seletor com os projetos já usados
  (evita duplicar por variação de digitação), com opção "Outro" para
  criar um novo; a lista de tarefas (pendentes e enviadas) passa a ser
  agrupada por projeto, com "Sem projeto" sempre por último.
- Nova aba "Podcasts": controle de assinaturas (busca via iTunes Search
  API — pública, sem chave — trazendo capa, autor/apresentador,
  categoria e link; cadastro manual também disponível) e episódios
  ouvidos vinculados a uma assinatura, com duração, data, estrelas e
  opinião. Editar/remover em ambos; remover uma assinatura não apaga
  os episódios já registrados (guardam o nome do podcast como
  snapshot histórico) (issue #22).
- Filmes: colar um link do YouTube no campo de busca e clicar em
  "Buscar" traz os dados do vídeo (título, miniatura, canal) via
  oEmbed do YouTube — público, sem precisar de chave. O campo de busca
  agora aparece mesmo sem a chave da OMDb configurada (só a busca por
  título continua exigindo a chave); "Onde assistiu" já vem
  pré-selecionado como YouTube (issue #21).
- Nova aba "Backlog", ao lado de "Hoje": lista de coisas para fazer, com
  projeto (opcional), ação, prazo início/fim (opcionais) e descrição.
  Cada tarefa ganha um botão "Enviar para hoje" que cria o objetivo do
  dia a partir dela (some da lista ativa e vai para "Enviadas", com
  opção de desfazer). "Objetivos do dia" passa a ter um limite rígido
  de 10 itens (regra 1-3-5) — tanto ao adicionar manualmente quanto ao
  enviar do Backlog; a migração automática de pendências (issue #12)
  respeita o mesmo limite, sem nunca perder um item pendente (issue #20).
- Entregas: checkbox "Não entregue" ao lado de "Entregue" — os dois
  funcionam como um par (marcar um desmarca o outro); marcar "Não
  entregue" cancela uma confirmação de entrega em andamento (issue #19).

### Fixed
- Entregas: uma data de previsão/compra/entrega inválida ou corrompida
  não aparece mais como "Invalid Date" no card — é tratada como ausente
  (issue #19).
- Filmes: dois novos tipos no cadastro manual, **Show** e **Palestra**
  (além de Filme e Série), e **YouTube** como opção em "Onde assistiu"
  (junto de TV aberta, Cinema e Streaming) (issue #18).
- Editar um registro já cadastrado, em vez de só adicionar/remover:
  botão "Editar" em Entregas (na lista ativa e no arquivo) e em
  Filmes/séries, reabrindo o formulário preenchido com os dados atuais
  — salvar atualiza o mesmo registro (mesmo `id`), sem criar um
  duplicado (issue #17).
- Entregas: campo "Entregue" (checkbox + data) em cada entrega aguardando
  recebimento. Ao marcar, confirma a data (padrão hoje, editável) e o
  registro sai da lista ativa e vai para uma seção "Arquivo" (recolhível),
  mostrando "Entregue em DD/MM/AAAA"; dá para desfazer (volta para
  aguardando entrega) ou remover definitivamente em qualquer um dos dois
  lugares (issue #16).
- Nova aba "Entregas", entre "Hoje" e "Filmes": cadastro de compras
  aguardando entrega (nome, data da compra, previsão de entrega,
  loja/e-commerce, número de rastreio e observações). Cadastro 100%
  manual (sem integração externa — cada transportadora tem seu próprio
  rastreamento); a lista ordena pela previsão mais próxima primeiro e
  destaca em vermelho as entregas com previsão vencida (issue #15).
- Nova aba "Livros": registro de livros lidos/em leitura, com capa, autor,
  editora, idioma e número de páginas, buscados via **Open Library API**
  (gratuita, sem chave — diferente da OMDb usada em Filmes). Como a
  leitura demora, cada registro tem data de início e data de fim
  (fim em branco = ainda lendo). Mesma avaliação pessoal de Filmes
  (estrelas + opinião); registro manual sempre disponível como
  alternativa à busca (issue #14).
- Filmes: registro de séries passa a ser **por episódio** (temporada,
  número do episódio e título do episódio opcional); tanto filmes quanto
  séries ganharam o campo "Onde assistiu" (TV aberta, Cinema ou Streaming
  — e, nesse caso, o serviço: Netflix, Mubi, HBO Max, Prime Video, Apple
  TV+ etc., ou "Outro" para digitar) (issue #13).
- Objetivos do dia: regra 1-3-5 (lista fechada, estilo Bullet Journal) —
  a cor de cada objetivo vem da sua **posição** na lista (1ª = vermelho
  claro/urgente, 2ª–4ª = amarelo claro, 5ª–9ª = verde clarinho, 10ª em
  diante = cinza claro), e arrastar para reordenar é como se muda a
  prioridade. Objetivos não concluídos migram automaticamente para o
  dia seguinte assim que o app é aberto num dia novo — o original fica
  marcado "Migrado" no dia de origem (congelado, só histórico), sem
  migrar de novo. Cada objetivo ganhou nota curta opcional, no mesmo
  padrão dos demais itens (ícone de lápis, fechada por padrão) (issue
  #12).
- Rebranding do template para **LogZen** (`node scripts/setup.mjs`): nome,
  repositório, autor, licença e cor da marca (issue #1).
- Tela "Hoje": registro diário de hábitos em 5 categorias (Exercícios,
  Vícios, Hábitos, Ânimo/Saúde mental, Atividade sexual), cada uma com o
  tipo de input adequado (contador, contador invertido com streak,
  checkbox, escala de estrelas, tags) em blocos retráteis. Dados
  armazenados 100% localmente no navegador (`localStorage`), sem backend,
  com exportação/importação em JSON (issue #1).
- Itens customizados: cada categoria da tela "Hoje" ganhou um formulário
  "Adicionar item" (nome + tipo de input — contador, contador invertido,
  sim/não, escala ou tags — e campos condicionais de unidade/opções);
  itens customizados podem ser removidos (os do catálogo padrão não).
  Nota do dia: campo de texto livre e opcional no lançamento diário
  (issue #2).
- Nota por item: todo item da tela "Hoje" (padrão ou customizado, de
  qualquer tipo) ganhou um ícone de lápis que abre uma caixa de texto
  curta e opcional (fechada por padrão); o ícone muda de cor quando já
  existe uma nota salva para aquele item, mesmo com a caixa fechada
  (issue #3).
- Navegação entre dias na tela "Hoje": setas anterior/próximo ao lado da
  data (a seta de avançar trava no dia atual, sem ir para o futuro) e
  link "Voltar para hoje" quando estiver em outro dia. Categorias, nota
  do dia e notas por item passam a refletir o dia selecionado (issue #5).
- Reordenar categorias e itens por arrastar e soltar, na seção "Itens
  rastreados" em Configurações (issue #6): cada categoria e cada item
  (padrão ou customizado) ganha uma alça de arrastar. Implementado com
  Pointer Events (funciona em toque, não só com mouse); itens só
  reordenam dentro da própria categoria. A ordem escolhida é salva
  localmente e aplicada também na tela "Hoje" (issue #7).

- Objetivos do dia: bloco de tarefas ad-hoc no início da tela "Hoje"
  (aberto por padrão) — adicionar (texto livre), marcar concluído
  (risca o texto) e remover. Guardado por data, junto com o resto do
  registro do dia (issue #9).
- Categorias sugeridas (Esporte, Cultura, Farmácia/Medicamentos, Vida
  social, Estudos, Alimentação, Finanças, Trabalho, Sono) e seção
  "Adicionar categoria" em Configurações — ativa uma sugerida ou cria
  uma totalmente personalizada; funciona igual às 5 originais (itens,
  arrastar para reordenar) e pode ser removida sem apagar o histórico
  já salvo (issue #10).
- Nova aba "Filmes": registro de filmes/séries assistidos, com busca
  de pôster/duração/prêmios via OMDb API (chave própria do usuário,
  colada em Configurações → Filmes — nunca embutida no código, já que
  o site é estático) e avaliação pessoal (estrelas + opinião). Sem
  chave configurada, o registro manual continua funcionando (issue
  #11).

### Changed
- "Nota do dia" virou **"Como foi meu dia"** e saiu do início da tela
  "Hoje" para o final, depois de todas as categorias (issue #9).
- Exportar/importar dados (JSON) saiu do cabeçalho da tela "Hoje" e virou
  uma seção "Salvar/backup" em Configurações, com rótulos completos
  (issue #4).
- Adicionar/editar/excluir item saiu da tela "Hoje" e virou a seção
  "Itens rastreados" em Configurações, com todas as categorias e itens
  padrão (somente leitura) e customizados (editáveis). Editar agora é
  possível (nome, unidade ou opções — o tipo de input não muda depois de
  criado). Excluir continua **sem apagar os registros já salvos**: o
  `id` interno nunca muda e o histórico por data permanece no
  armazenamento local, só o item deixa de aparecer (issue #6).
- Todo item passa a ser editável/excluível em "Itens rastreados",
  inclusive os do catálogo de fábrica — a etiqueta "Padrão" e a
  restrição de somente leitura saíram. Editar/excluir um item padrão
  não altera `logzen-items.js`: grava um ajuste local (nome/unidade/
  opções) ou marca o id como escondido, sem tocar no histórico salvo
  nem permitir que um item novo reaproveite o id de um item padrão
  escondido (issue #8).

## [0.0.1] - Base inicial

### Adicionado
- Estrutura inicial do projeto a partir do modelo **templateZen**:
  cabeçalho/rodapé compartilhados (`src/js/chrome.js`), 16 temas + "Padrão"
  (WCAG AA), páginas de apoio, build (`build.mjs`) e CI/CD (deploy via SSH,
  auto-bump do PATCH). As próximas mudanças serão documentadas aqui,
  referenciando o número da issue.
