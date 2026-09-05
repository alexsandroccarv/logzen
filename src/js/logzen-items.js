/* ==========================================================================
   LogZen — Catálogo de itens rastreados, organizados por categoria.
   Cada item declara o tipo de input mais adequado à sua natureza (ver
   issue #1). Editar esta lista é a forma de adicionar/remover itens do
   rastreamento diário nesta fase (sem UI de gestão ainda).
   ========================================================================== */
window.LOGZEN_CATEGORIES = [
    {
        id: 'exercicios',
        nome: 'Exercícios',
        icone: 'fa-dumbbell',
        descricao: 'Volume do treino de hoje.',
        itens: [
            { id: 'flexoes', nome: 'Flexões', tipo: 'contador', unidade: 'reps', passoRapido: 10 },
            { id: 'abdominais', nome: 'Abdominais', tipo: 'contador', unidade: 'reps', passoRapido: 10 },
            { id: 'barras', nome: 'Barras', tipo: 'contador', unidade: 'reps', passoRapido: 5 },
        ],
    },
    {
        id: 'vicios',
        nome: 'Vícios',
        icone: 'fa-wine-bottle',
        descricao: 'Menos é melhor — o ideal é manter em 0.',
        itens: [
            { id: 'alcool', nome: 'Álcool', tipo: 'contador-inverso', unidade: 'doses', passoRapido: 1 },
        ],
    },
    {
        id: 'habitos',
        nome: 'Hábitos',
        icone: 'fa-leaf',
        descricao: 'Consistência do dia a dia.',
        itens: [
            { id: 'yoga', nome: 'Fiz yoga', tipo: 'checkbox' },
            { id: 'agua', nome: 'Água', tipo: 'contador', unidade: 'copos (250ml)', passoRapido: 1, passoLitro: 4 },
        ],
    },
    {
        id: 'animo',
        nome: 'Ânimo / Saúde mental',
        icone: 'fa-brain',
        descricao: 'Padrões de humor e possíveis gatilhos.',
        itens: [
            { id: 'humor', nome: 'Acordei bem', tipo: 'escala', max: 5 },
            {
                id: 'eventos', nome: 'Eventos do dia', tipo: 'tags',
                opcoes: ['Ansiedade', 'Foco alto', 'Irritação', 'Cansaço', 'Gratidão'],
            },
        ],
    },
    {
        id: 'atividade_sexual',
        nome: 'Atividade sexual',
        icone: 'fa-heart',
        descricao: 'Apenas ocorrência no dia.',
        itens: [
            { id: 'penetracao', nome: 'Sexo com penetração', tipo: 'checkbox' },
            { id: 'sem_penetracao', nome: 'Sexo sem penetração', tipo: 'checkbox' },
            { id: 'masturbacao', nome: 'Masturbação', tipo: 'checkbox' },
            { id: 'beijo', nome: 'Beijo', tipo: 'checkbox' },
        ],
    },
];
