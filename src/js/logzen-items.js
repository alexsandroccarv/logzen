/* ==========================================================================
   LogZen — Catálogo de itens rastreados, organizados por categoria.
   Cada item declara o tipo de input mais adequado à sua natureza (ver
   issue #1). Editar esta lista é a forma de adicionar/remover itens do
   rastreamento diário nesta fase (sem UI de gestão ainda).

   Na versão inicial (issue #26) o app começa sem nenhuma categoria/item
   pré-ativado — LOGZEN_CATEGORIES fica vazio de propósito. O usuário monta
   o próprio catálogo do zero em Configurações → "Itens rastreados"/
   "Adicionar categoria", ativando uma sugestão abaixo ou criando a sua.
   ========================================================================== */
window.LOGZEN_CATEGORIES = [];

/* ==========================================================================
   Categorias sugeridas (issue #10) — não ativas por padrão. O usuário
   ativa uma (ou cria uma totalmente personalizada) em Configurações →
   "Adicionar categoria"; a partir daí funciona igual a qualquer outra
   (itens, arrastar para reordenar, etc.), sempre começando sem itens.
   ========================================================================== */
window.LOGZEN_CATEGORIAS_SUGERIDAS = [
    { id: 'exercicios', nome: 'Exercícios', icone: 'fa-dumbbell', descricao: 'Volume do treino de hoje.' },
    { id: 'vicios', nome: 'Vícios', icone: 'fa-wine-bottle', descricao: 'Menos é melhor — o ideal é manter em 0.' },
    { id: 'habitos', nome: 'Hábitos', icone: 'fa-leaf', descricao: 'Consistência do dia a dia.' },
    { id: 'animo', nome: 'Ânimo / Saúde mental', icone: 'fa-brain', descricao: 'Padrões de humor e possíveis gatilhos.' },
    { id: 'atividade_sexual', nome: 'Atividade sexual', icone: 'fa-heart', descricao: 'Apenas ocorrência no dia.' },
    { id: 'esporte', nome: 'Esporte', icone: 'fa-futbol', descricao: 'Prática esportiva e atividade física.' },
    { id: 'cultura', nome: 'Cultura', icone: 'fa-masks-theater', descricao: 'Livros, cinema, teatro, museus.' },
    { id: 'farmacia', nome: 'Farmácia / Medicamentos', icone: 'fa-pills', descricao: 'Remédios e cuidados de saúde.' },
    { id: 'vida_social', nome: 'Vida social', icone: 'fa-people-group', descricao: 'Encontros, amigos, família.' },
    { id: 'estudos', nome: 'Estudos', icone: 'fa-book', descricao: 'Cursos, leitura técnica, aprendizado.' },
    { id: 'alimentacao', nome: 'Alimentação', icone: 'fa-utensils', descricao: 'Refeições e hábitos alimentares.' },
    { id: 'financas', nome: 'Finanças', icone: 'fa-sack-dollar', descricao: 'Gastos, economia, investimentos.' },
    { id: 'trabalho', nome: 'Trabalho', icone: 'fa-briefcase', descricao: 'Produtividade e rotina profissional.' },
    { id: 'sono', nome: 'Sono', icone: 'fa-bed', descricao: 'Qualidade e horário de sono.' },
];
