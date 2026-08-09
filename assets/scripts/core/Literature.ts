/**
 * 小学文藏库：按 1–6 年级收纳「古诗 + 名言名句 + 经典文言文」
 *
 * 藏法：
 * 1) 每条带 grade（年级）+ kind（poem|quote|prose）
 * 2) 关卡按年级递进：第 1–5 关→一年级 … 第 26–30 关→六年级
 * 3) 通关收入文藏馆，可按类型筛选
 */

export type VerseKind = 'poem' | 'quote' | 'prose';
/** 小学年级 1–6 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export interface Verse {
    id: string;
    kind: VerseKind;
    /** 所属小学年级 */
    grade: Grade;
    title: string;
    author: string;
    /** 朝代或出处 */
    source: string;
    lines: string[];
}

function P(
    id: string,
    grade: Grade,
    title: string,
    author: string,
    source: string,
    lines: string[],
): Verse {
    return { id, kind: 'poem', grade, title, author, source, lines };
}

function Q(
    id: string,
    grade: Grade,
    title: string,
    author: string,
    source: string,
    lines: string[],
): Verse {
    return { id, kind: 'quote', grade, title, author, source, lines };
}

function W(
    id: string,
    grade: Grade,
    title: string,
    author: string,
    source: string,
    lines: string[],
): Verse {
    return { id, kind: 'prose', grade, title, author, source, lines };
}

/** 小学必背/常背古诗（按年级） */
export const POEMS: Verse[] = [
    // —— 一年级 ——
    P('p1_yonger', 1, '咏鹅', '骆宾王', '唐', ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。']),
    P('p1_jingyesi', 1, '静夜思', '李白', '唐', ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。']),
    P('p1_chunxiao', 1, '春晓', '孟浩然', '唐', ['春眠不觉晓，', '处处闻啼鸟。', '夜来风雨声，', '花落知多少。']),
    P('p1_minnong', 1, '悯农', '李绅', '唐', ['锄禾日当午，', '汗滴禾下土。', '谁知盘中餐，', '粒粒皆辛苦。']),
    P('p1_gulang', 1, '古朗月行', '李白', '唐', ['小时不识月，', '呼作白玉盘。', '又疑瑶台镜，', '飞在青云端。']),

    // —— 二年级 ——
    P('p2_denglou', 2, '登鹳雀楼', '王之涣', '唐', ['白日依山尽，', '黄河入海流。', '欲穷千里目，', '更上一层楼。']),
    P('p2_wanglu', 2, '望庐山瀑布', '李白', '唐', ['日照香炉生紫烟，', '遥看瀑布挂前川。', '飞流直下三千尺，', '疑是银河落九天。']),
    P('p2_yesu', 2, '夜宿山寺', '李白', '唐', ['危楼高百尺，', '手可摘星辰。', '不敢高声语，', '恐惊天上人。']),
    P('p2_chile', 2, '敕勒歌', '北朝民歌', '北朝', ['敕勒川，阴山下。', '天似穹庐，', '笼盖四野。', '天苍苍，野茫茫，', '风吹草低见牛羊。']),
    P('p2_yongliu', 2, '咏柳', '贺知章', '唐', ['碧玉妆成一树高，', '万条垂下绿丝绦。', '不知细叶谁裁出，', '二月春风似剪刀。']),

    // —— 三年级 ——
    P('p3_caosongbie', 3, '赋得古原草送别', '白居易', '唐', ['离离原上草，', '一岁一枯荣。', '野火烧不尽，', '春风吹又生。']),
    P('p3_zengwanglun', 3, '赠汪伦', '李白', '唐', ['李白乘舟将欲行，', '忽闻岸上踏歌声。', '桃花潭水深千尺，', '不及汪伦送我情。']),
    P('p3_huanghelou', 3, '黄鹤楼送孟浩然之广陵', '李白', '唐', ['故人西辞黄鹤楼，', '烟花三月下扬州。', '孤帆远影碧空尽，', '唯见长江天际流。']),
    P('p3_wangtianmen', 3, '望天门山', '李白', '唐', ['天门中断楚江开，', '碧水东流至此回。', '两岸青山相对出，', '孤帆一片日边来。']),
    P('p3_feng', 3, '风', '李峤', '唐', ['解落三秋叶，', '能开二月花。', '过江千尺浪，', '入竹万竿斜。']),

    // —— 四年级 ——
    P('p4_chusai', 4, '出塞', '王昌龄', '唐', ['秦时明月汉时关，', '万里长征人未还。', '但使龙城飞将在，', '不教胡马度阴山。']),
    P('p4_liangzhou', 4, '凉州词', '王翰', '唐', ['葡萄美酒夜光杯，', '欲饮琵琶马上催。', '醉卧沙场君莫笑，', '古来征战几人回？']),
    P('p4_xiari', 4, '夏日绝句', '李清照', '宋', ['生当作人杰，', '死亦为鬼雄。', '至今思项羽，', '不肯过江东。']),
    P('p4_biedongda', 4, '别董大', '高适', '唐', ['千里黄云白日曛，', '北风吹雁雪纷纷。', '莫愁前路无知己，', '天下谁人不识君？']),
    P('p4_xilin', 4, '题西林壁', '苏轼', '宋', ['横看成岭侧成峰，', '远近高低各不同。', '不识庐山真面目，', '只缘身在此山中。']),

    // —— 五年级 ——
    P('p5_qibu', 5, '七步诗', '曹植', '三国', ['煮豆燃豆萁，', '豆在釜中泣。', '本自同根生，', '相煎何太急？']),
    P('p5_niaoming', 5, '鸟鸣涧', '王维', '唐', ['人闲桂花落，', '夜静春山空。', '月出惊山鸟，', '时鸣春涧中。']),
    P('p5_fengqiao', 5, '枫桥夜泊', '张继', '唐', ['月落乌啼霜满天，', '江枫渔火对愁眠。', '姑苏城外寒山寺，', '夜半钟声到客船。']),
    P('p5_yugezi', 5, '渔歌子', '张志和', '唐', ['西塞山前白鹭飞，', '桃花流水鳜鱼肥。', '青箬笠，绿蓑衣，', '斜风细雨不须归。']),
    P('p5_shier', 5, '示儿', '陆游', '宋', ['死去元知万事空，', '但悲不见九州同。', '王师北定中原日，', '家祭无忘告乃翁。']),

    // —— 六年级 ——
    P('p6_zhushi', 6, '竹石', '郑燮', '清', ['咬定青山不放松，', '立根原在破岩中。', '千磨万击还坚劲，', '任尔东西南北风。']),
    P('p6_shihui', 6, '石灰吟', '于谦', '明', ['千锤万凿出深山，', '烈火焚烧若等闲。', '粉骨碎身浑不怕，', '要留清白在人间。']),
    P('p6_jihai', 6, '己亥杂诗', '龚自珍', '清', ['九州生气恃风雷，', '万马齐喑究可哀。', '我劝天公重抖擞，', '不拘一格降人才。']),
    P('p6_huanxisha', 6, '浣溪沙', '苏轼', '宋', ['山下兰芽短浸溪，', '松间沙路净无泥，', '潇潇暮雨子规啼。', '谁道人生无再少？', '门前流水尚能西！', '休将白发唱黄鸡。']),
    P('p6_changxiangsi', 6, '长相思', '纳兰性德', '清', ['山一程，水一程，', '身向榆关那畔行，', '夜深千帐灯。', '风一更，雪一更，', '聒碎乡心梦不成，', '故园无此声。']),
];

/** 小学常见名言名句（按年级难度递进） */
export const QUOTES: Verse[] = [
    Q('q1_xueer', 1, '学而时习之', '孔子', '论语', ['学而时习之，', '不亦说乎？']),
    Q('q1_sanren', 1, '三人行', '孔子', '论语', ['三人行，', '必有我师焉。']),
    Q('q1_yushui', 1, '玉不琢', '《礼记》', '学记', ['玉不琢，不成器；', '人不学，不知道。']),
    Q('q1_shaozhuang', 1, '少壮不努力', '汉乐府', '长歌行', ['少壮不努力，', '老大徒伤悲。']),
    Q('q1_hei', 1, '黑发不知勤学早', '颜真卿', '劝学', ['黑发不知勤学早，', '白首方悔读书迟。']),

    Q('q2_zhi', 2, '知之为知之', '孔子', '论语', ['知之为知之，', '不知为不知，', '是知也。']),
    Q('q2_qianli', 2, '千里之行', '老子', '道德经', ['千里之行，', '始于足下。']),
    Q('q2_bao', 2, '宝剑锋从磨砺出', '警世贤文', '传统名句', ['宝剑锋从磨砺出，', '梅花香自苦寒来。']),
    Q('q2_dushu', 2, '读书破万卷', '杜甫', '唐', ['读书破万卷，', '下笔如有神。']),
    Q('q2_shan', 2, '山重水复', '陆游', '游山西村', ['山重水复疑无路，', '柳暗花明又一村。']),

    Q('q3_tianxing', 3, '天行健', '《周易》', '周易', ['天行健，', '君子以自强不息。']),
    Q('q3_diwei', 3, '地势坤', '《周易》', '周易', ['地势坤，', '君子以厚德载物。']),
    Q('q3_heshi', 3, '合抱之木', '老子', '道德经', ['合抱之木，生于毫末；', '九层之台，起于累土。']),
    Q('q3_zhishang', 3, '纸上得来终觉浅', '陆游', '冬夜读书示子聿', ['纸上得来终觉浅，', '绝知此事要躬行。']),
    Q('q3_bowen', 3, '博学之', '《中庸》', '中庸', ['博学之，审问之，', '慎思之，明辨之，笃行之。']),

    Q('q4_haoshi', 4, '好读书', '陶渊明', '五柳先生传', ['好读书，不求甚解；', '每有会意，便欣然忘食。']),
    Q('q4_sanli', 4, '三军可夺帅', '孔子', '论语', ['三军可夺帅也，', '匹夫不可夺志也。']),
    Q('q4_wen', 4, '温故而知新', '孔子', '论语', ['温故而知新，', '可以为师矣。']),
    Q('q4_min', 4, '敏而好学', '孔子', '论语', ['敏而好学，', '不耻下问。']),
    Q('q4_zhixing', 4, '知行合一', '王阳明', '传习录', ['知是行之始，', '行是知之成。']),

    Q('q5_xiuqi', 5, '修身齐家', '《大学》', '大学', ['物格而后知至，', '知至而后意诚。']),
    Q('q5_ju', 5, '天下兴亡', '顾炎武', '日知录', ['天下兴亡，', '匹夫有责。']),
    Q('q5_lu', 5, '路漫漫', '屈原', '离骚', ['路漫漫其修远兮，', '吾将上下而求索。']),
    Q('q5_xian', 5, '先天下之忧', '范仲淹', '岳阳楼记', ['先天下之忧而忧，', '后天下之乐而乐。']),
    Q('q5_fu', 5, '富贵不能淫', '孟子', '滕文公下', ['富贵不能淫，', '贫贱不能移，', '威武不能屈。']),

    Q('q6_qing', 6, '天生我材', '李白', '将进酒', ['天生我材必有用，', '千金散尽还复来。']),
    Q('q6_changfeng', 6, '长风破浪', '李白', '行路难', ['长风破浪会有时，', '直挂云帆济沧海。']),
    Q('q6_hai', 6, '海纳百川', '林则徐', '联语', ['海纳百川，有容乃大；', '壁立千仞，无欲则刚。']),
    Q('q6_wei', 6, '为中华之崛起', '周恩来', '少年立志', ['为中华之崛起', '而读书。']),
    Q('q6_shi', 6, '时光不待人', '陶渊明', '杂诗', ['盛年不重来，', '一日难再晨。', '及时当勉励，', '岁月不待人。']),
];

/** 经典文言文短章/节选（控制字数，便于按序点亮） */
export const PROSE: Verse[] = [
    // —— 一年级：蒙学短章 ——
    W('w1_renzhichu', 1, '人之初', '王应麟', '三字经', ['人之初，性本善。', '性相近，习相远。']),
    W('w1_dixiong', 1, '兄道友', '李毓秀', '弟子规', ['兄道友，弟道恭。', '兄弟睦，孝在中。']),
    W('w1_youpeng', 1, '有朋自远方来', '孔子', '论语·学而', ['有朋自远方来，', '不亦乐乎？']),

    // —— 二年级：寓言入门 ——
    W('w2_shouzhu', 2, '守株待兔', '韩非', '韩非子', ['宋人有耕者，', '田中有株。', '兔走触株，', '折颈而死。']),
    W('w2_wangyang', 2, '亡羊补牢', '《战国策》', '楚策', ['见兔而顾犬，', '未为晚也；', '亡羊而补牢，', '未为迟也。']),
    W('w2_yugong', 2, '愚公移山', '列子', '汤问', ['北山愚公者，', '年且九十，', '面山而居。']),

    // —— 三年级：成语故事 ——
    W('w3_kezi', 3, '刻舟求剑', '《吕氏春秋》', '察今', ['楚人有涉江者，', '其剑自舟中坠于水，', '遽契其舟。']),
    W('w3_yaner', 3, '掩耳盗铃', '《吕氏春秋》', '自知', ['有得钟者，', '欲负而走，', '则钟大不可负。']),
    W('w3_huashe', 3, '画蛇添足', '《战国策》', '齐策', ['一人蛇先成，', '引酒且饮，', '乃左手持卮，', '右手画蛇。']),

    // —— 四年级：诸子短章 ——
    W('w4_lanyu', 4, '滥竽充数', '韩非', '韩非子', ['齐宣王使人吹竽，', '必三百人。', '南郭处士请为王吹竽。']),
    W('w4_maoshi', 4, '矛盾', '韩非', '韩非子', ['楚人有鬻盾与矛者，', '誉之曰：', '吾盾之坚，', '物莫能陷也。']),
    W('w4_huzhi', 4, '狐假虎威', '《战国策》', '楚策', ['虎求百兽而食之，', '得狐。', '狐曰：', '子无敢食我也。']),

    // —— 五年级：名篇节选 ——
    W('w5_loushi', 5, '陋室铭', '刘禹锡', '唐', ['山不在高，有仙则名。', '水不在深，有龙则灵。', '斯是陋室，惟吾德馨。']),
    W('w5_ailian', 5, '爱莲说', '周敦颐', '宋', ['予独爱莲之出淤泥而不染，', '濯清涟而不妖。']),
    W('w5_xiaoshiguo', 5, '两小儿辩日', '列子', '汤问', ['孔子东游，', '见两小儿辩斗，', '问其故。']),

    // —— 六年级：古文精华 ——
    W('w6_taohua', 6, '桃花源记', '陶渊明', '晋', ['忽逢桃花林，', '夹岸数百步，', '中无杂树，', '芳草鲜美，落英缤纷。']),
    W('w6_yueyang', 6, '岳阳楼记', '范仲淹', '宋', ['不以物喜，不以己悲。', '居庙堂之高则忧其民，', '处江湖之远则忧其君。']),
    W('w6_chushi', 6, '出师表', '诸葛亮', '三国', ['亲贤臣，远小人，', '此先汉所以兴隆也；', '亲小人，远贤臣，', '此后汉所以倾颓也。']),
];

export type Poem = Verse;
export const LEVEL_POEMS = POEMS;

const KIND_POOL: Record<VerseKind, Verse[]> = {
    poem: POEMS,
    quote: QUOTES,
    prose: PROSE,
};

/** 每 5 关一个年级：1–5→一 … 26–30→六 */
export function gradeForLevel(levelId: number): Grade {
    const g = Math.ceil(Math.max(1, levelId) / 5);
    return Math.min(6, g) as Grade;
}

export function gradeLabel(g: Grade): string {
    return `${['', '一', '二', '三', '四', '五', '六'][g]}年级`;
}

export function versesByGrade(grade: Grade, kind?: VerseKind): Verse[] {
    const pool = kind ? KIND_POOL[kind] : [...POEMS, ...QUOTES, ...PROSE];
    return pool.filter((v) => v.grade === grade);
}

/**
 * 关卡文藏：年级内按 古诗 → 名言 → 文言文 轮换
 */
export function getVerseForLevel(levelId: number): Verse {
    const grade = gradeForLevel(levelId);
    const local = ((levelId - 1) % 5) + 1; // 本年级第几关 1–5
    const kinds: VerseKind[] = ['poem', 'quote', 'prose'];
    const kind = kinds[(local - 1) % kinds.length];
    const pool = versesByGrade(grade, kind);
    if (!pool.length) {
        const any = versesByGrade(grade);
        return any[0] || POEMS[0];
    }
    const i = Math.floor((local - 1) / kinds.length) % pool.length;
    return pool[i] || pool[0];
}

export function getPoemForLevel(levelId: number): Verse {
    return getVerseForLevel(levelId);
}

export function verseKindLabel(kind: VerseKind): string {
    if (kind === 'poem') return '古诗';
    if (kind === 'quote') return '名言';
    return '文言文';
}

export function verseFullText(v: Verse): string {
    return `${v.title}\n${v.source} · ${v.author}\n${v.lines.join('\n')}`;
}

export function poemFullText(p: Verse): string {
    return verseFullText(p);
}

export function verseCharSequence(v: Verse): string[] {
    const out: string[] = [];
    for (const ch of v.lines.join('')) {
        if (ch >= '\u4e00' && ch <= '\u9fff') out.push(ch);
    }
    return out.length ? out : ['文'];
}

export function poemCharSequence(levelId: number): string[] {
    return verseCharSequence(getVerseForLevel(levelId));
}

/** 未点亮用横线占位（避免〇像椭圆） */
export function formatVerseProgress(v: Verse, revealed: number): string {
    let idx = 0;
    return v.lines
        .map((line) => {
            const parts: string[] = [];
            for (const ch of line) {
                if (ch >= '\u4e00' && ch <= '\u9fff') {
                    parts.push(idx < revealed ? ch : '＿');
                    idx++;
                } else if (ch === '，' || ch === '。' || ch === '？' || ch === '！' || ch === '、') {
                    parts.push(ch);
                } else if (ch.trim()) {
                    parts.push(ch);
                }
            }
            // 字间略疏，读起来更像笺纸
            return parts.join(' ');
        })
        .join('\n');
}

export function formatPoemProgress(levelId: number, revealed: number): string {
    return formatVerseProgress(getVerseForLevel(levelId), revealed);
}

export function allVerses(): Verse[] {
    return [...POEMS, ...QUOTES, ...PROSE];
}

export function versesByKind(kind: VerseKind): Verse[] {
    return KIND_POOL[kind];
}
