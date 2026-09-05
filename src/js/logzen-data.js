/* ==========================================================================
   LogZen — Camada de dados (armazenamento 100% local, sem backend — ver
   issue #1). Guarda um registro por dia (chave YYYY-MM-DD) em localStorage,
   namespaced para não colidir com as chaves do chrome.js/layout.js.
   ========================================================================== */
window.LogZenData = (function () {
    const STORAGE_KEY = 'logzen:entries:v1';

    function todayKey(d) {
        const date = d || new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function readAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeAll(all) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
        catch (e) { /* storage indisponível (aba anônima/cota) — segue sem persistir */ }
    }

    function getEntry(dateKey) {
        return readAll()[dateKey] || {};
    }

    function getItemValue(dateKey, categoriaId, itemId, fallback) {
        const entry = getEntry(dateKey);
        const cat = entry[categoriaId];
        const v = cat ? cat[itemId] : undefined;
        return v === undefined ? fallback : v;
    }

    function setItemValue(dateKey, categoriaId, itemId, value) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        if (!all[dateKey][categoriaId]) all[dateKey][categoriaId] = {};
        all[dateKey][categoriaId][itemId] = value;
        writeAll(all);
    }

    function toggleTag(dateKey, categoriaId, itemId, tag) {
        const atuais = getItemValue(dateKey, categoriaId, itemId, []);
        const set = new Set(atuais);
        if (set.has(tag)) set.delete(tag); else set.add(tag);
        setItemValue(dateKey, categoriaId, itemId, Array.from(set));
        return set.has(tag);
    }

    // Streak de dias consecutivos (terminando ontem) em que o item ficou em
    // zero/ausente — usado pelos itens do tipo "contador-inverso" (vícios).
    function streakZerado(categoriaId, itemId, upToDateKey) {
        const all = readAll();
        let streak = 0;
        const cursor = upToDateKey ? new Date(upToDateKey + 'T00:00:00') : new Date();
        for (let i = 0; i < 3650; i++) {
            const key = todayKey(cursor);
            const entry = all[key];
            const v = entry && entry[categoriaId] ? entry[categoriaId][itemId] : undefined;
            if (v) break; // qualquer valor "truthy" (>0) interrompe a sequência
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    }

    function getNota(dateKey) {
        return getEntry(dateKey).nota || '';
    }

    function setNota(dateKey, texto) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        all[dateKey].nota = texto;
        writeAll(all);
    }

    function exportJSON() {
        return JSON.stringify(readAll(), null, 2);
    }

    function importJSON(json) {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') writeAll(parsed);
    }

    return { todayKey, getEntry, getItemValue, setItemValue, toggleTag, streakZerado, getNota, setNota, exportJSON, importJSON };
})();
