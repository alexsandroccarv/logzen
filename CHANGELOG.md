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

## [0.0.1] - Base inicial

### Adicionado
- Estrutura inicial do projeto a partir do modelo **templateZen**:
  cabeçalho/rodapé compartilhados (`src/js/chrome.js`), 16 temas + "Padrão"
  (WCAG AA), páginas de apoio, build (`build.mjs`) e CI/CD (deploy via SSH,
  auto-bump do PATCH). As próximas mudanças serão documentadas aqui,
  referenciando o número da issue.
