/** 兼容旧引用：统一从 Literature 导出 */
export {
    LEVEL_POEMS,
    POEMS,
    PROSE,
    QUOTES,
    allVerses,
    formatPoemProgress,
    formatVerseProgress,
    getPoemForLevel,
    getVerseForLevel,
    gradeForLevel,
    gradeLabel,
    poemCharSequence,
    poemFullText,
    verseCharSequence,
    verseFullText,
    verseKindLabel,
    versesByGrade,
    versesByKind,
} from './Literature';
export type { Grade, Poem, Verse, VerseKind } from './Literature';
