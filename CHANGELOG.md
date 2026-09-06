# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Added
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

### Changed
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

## [0.0.1] - Base inicial

### Adicionado
- Estrutura inicial do projeto a partir do modelo **templateZen**:
  cabeçalho/rodapé compartilhados (`src/js/chrome.js`), 16 temas + "Padrão"
  (WCAG AA), páginas de apoio, build (`build.mjs`) e CI/CD (deploy via SSH,
  auto-bump do PATCH). As próximas mudanças serão documentadas aqui,
  referenciando o número da issue.
