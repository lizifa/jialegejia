#!/usr/bin/env python3
"""按 26 英文字母造型生成关卡 JSON（col/row/layer，数量为 3 的倍数）"""
from __future__ import annotations
import json
import random
from pathlib import Path

OUT = Path('/Volumes/bag/cocos/jialegejia/assets/resources/levels')

# 5×7 点阵（1=有块）。行从上到下，列从左到右
LETTERS: dict[str, list[str]] = {
    'A': [
        '.###.',
        '#...#',
        '#...#',
        '#####',
        '#...#',
        '#...#',
        '#...#',
    ],
    'B': [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#...#',
        '#...#',
        '####.',
    ],
    'C': [
        '.####',
        '#....',
        '#....',
        '#....',
        '#....',
        '#....',
        '.####',
    ],
    'D': [
        '####.',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '####.',
    ],
    'E': [
        '#####',
        '#....',
        '#....',
        '####.',
        '#....',
        '#....',
        '#####',
    ],
    'F': [
        '#####',
        '#....',
        '#....',
        '####.',
        '#....',
        '#....',
        '#....',
    ],
    'G': [
        '.####',
        '#....',
        '#....',
        '#.###',
        '#...#',
        '#...#',
        '.###.',
    ],
    'H': [
        '#...#',
        '#...#',
        '#...#',
        '#####',
        '#...#',
        '#...#',
        '#...#',
    ],
    'I': [
        '#####',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
        '#####',
    ],
    'J': [
        '..###',
        '....#',
        '....#',
        '....#',
        '#...#',
        '#...#',
        '.###.',
    ],
    'K': [
        '#...#',
        '#..#.',
        '#.#..',
        '##...',
        '#.#..',
        '#..#.',
        '#...#',
    ],
    'L': [
        '#....',
        '#....',
        '#....',
        '#....',
        '#....',
        '#....',
        '#####',
    ],
    'M': [
        '#...#',
        '##.##',
        '#.#.#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
    ],
    'N': [
        '#...#',
        '##..#',
        '#.#.#',
        '#..##',
        '#...#',
        '#...#',
        '#...#',
    ],
    'O': [
        '.###.',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.###.',
    ],
    'P': [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#....',
        '#....',
        '#....',
    ],
    'Q': [
        '.###.',
        '#...#',
        '#...#',
        '#...#',
        '#.#.#',
        '#..#.',
        '.##.#',
    ],
    'R': [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#.#..',
        '#..#.',
        '#...#',
    ],
    'S': [
        '.####',
        '#....',
        '#....',
        '.###.',
        '....#',
        '....#',
        '####.',
    ],
    'T': [
        '#####',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
    ],
    'U': [
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.###.',
    ],
    'V': [
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.#.#.',
        '.#.#.',
        '..#..',
    ],
    'W': [
        '#...#',
        '#...#',
        '#...#',
        '#.#.#',
        '#.#.#',
        '##.##',
        '#...#',
    ],
    'X': [
        '#...#',
        '.#.#.',
        '..#..',
        '..#..',
        '..#..',
        '.#.#.',
        '#...#',
    ],
    'Y': [
        '#...#',
        '.#.#.',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
        '..#..',
    ],
    'Z': [
        '#####',
        '....#',
        '...#.',
        '..#..',
        '.#...',
        '#....',
        '#####',
    ],
}

# 第 27–30 关用加宽/加厚变体字母
EXTRA = ['A', 'H', 'O', 'S']

POOL_BY_UNLOCK = [
    (1, ['book_red', 'book_blue', 'book_green', 'bear', 'rabbit', 'cat']),
    (2, ['book_yellow', 'cup']),
    (3, ['book_orange']),
    (4, ['box']),
    (6, ['gift']),
    (8, ['basket']),
]


def difficulty_tier(level_id: int) -> int:
    if level_id <= 5:
        return 1
    if level_id <= 10:
        return 2
    if level_id <= 18:
        return 3
    if level_id <= 25:
        return 4
    return 5

POEM_TITLES = [
    '静夜思', '春晓', '登鹳雀楼', '悯农', '咏鹅', '江雪', '寻隐者不遇', '鹿柴', '竹里馆', '相思',
    '九月九日忆山东兄弟', '赠汪伦', '早发白帝城', '望庐山瀑布', '黄鹤楼送孟浩然之广陵', '绝句', '绝句',
    '江畔独步寻花', '枫桥夜泊', '游子吟', '赋得古原草送别', '池上', '山行', '清明', '乐游原', '蜂',
    '元日', '泊船瓜洲', '题西林壁', '饮湖上初晴后雨',
]


def unlocked_types(level_id: int) -> list[str]:
    types: list[str] = []
    for unlock, ids in POOL_BY_UNLOCK:
        if level_id >= unlock:
            types.extend(ids)
    return types


TITLES = {
    'A': '字母书架 · A',
    'B': '字母书架 · B',
    'C': '字母书架 · C',
    'D': '字母书架 · D',
    'E': '字母书架 · E',
    'F': '字母书架 · F',
    'G': '字母书架 · G',
    'H': '字母书架 · H',
    'I': '字母书架 · I',
    'J': '字母书架 · J',
    'K': '字母书架 · K',
    'L': '字母书架 · L',
    'M': '字母书架 · M',
    'N': '字母书架 · N',
    'O': '字母书架 · O',
    'P': '字母书架 · P',
    'Q': '字母书架 · Q',
    'R': '字母书架 · R',
    'S': '字母书架 · S',
    'T': '字母书架 · T',
    'U': '字母书架 · U',
    'V': '字母书架 · V',
    'W': '字母书架 · W',
    'X': '字母书架 · X',
    'Y': '字母书架 · Y',
    'Z': '字母书架 · Z',
}


def cells_of(letter: str) -> list[tuple[int, int]]:
    grid = LETTERS[letter]
    cells = []
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            if ch == '#':
                cells.append((c, r))
    return cells


def pad_to_multiple_of_3(n: int) -> int:
    return n if n % 3 == 0 else n + (3 - n % 3)


def build_tiles(letter: str, level_id: int, thick: bool) -> list[dict]:
    """
    layer0: 字母全貌
    上层随难度加厚加高；后期种类更多、遮挡更密，迫使使用道具/广告
    """
    base = cells_of(letter)
    rng = random.Random(1000 + level_id * 17 + ord(letter))
    tier = difficulty_tier(level_id)

    cells = set(base)
    # 中后期加厚轮廓，增加可叠面积
    if thick or tier >= 3:
        extras = []
        for c, r in base:
            for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nc, nr = c + dc, r + dr
                if 0 <= nc < 5 and 0 <= nr < 7 and (nc, nr) not in cells:
                    extras.append((nc, nr))
        rng.shuffle(extras)
        take_extra = max(3, len(base) // (6 - min(tier, 4)))
        for p in extras[:take_extra]:
            cells.add(p)

    cells_list = sorted(cells, key=lambda p: (p[1], p[0]))
    n0 = len(cells_list)

    # 叠层：后期最高到 5～6
    max_layer = {1: 2, 2: 3, 3: 4, 4: 5, 5: 6}[tier]
    if thick:
        max_layer = min(6, max_layer + 1)

    layers: dict[int, list[tuple[int, int]]] = {0: cells_list[:]}
    scored = sorted(
        cells_list,
        key=lambda p: abs(p[0] - 2) + abs(p[1] - 3) + rng.random() * 0.3,
    )
    for L in range(1, max_layer + 1):
        # 上层覆盖率随难度升高
        ratio = 0.55 + tier * 0.06 - L * 0.05
        take = max(3, int(n0 * max(0.28, ratio)))
        take = pad_to_multiple_of_3(take)
        take = min(take, n0)
        if L > 1:
            take = min(take, max(3, len(layers[L - 1]) - 0))
        pick = scored[:]
        rng.shuffle(pick)
        # 中心优先 + 随机混合，制造难解遮挡
        center = scored[: max(3, take // 2)]
        rest = [p for p in pick if p not in center]
        chosen = (center + rest)[:take]
        layers[L] = sorted(chosen, key=lambda p: (p[1], p[0]))

    all_slots: list[tuple[int, int, int]] = []
    for L, pts in layers.items():
        for c, r in pts:
            all_slots.append((c, r, L))

    while len(all_slots) % 3 != 0:
        top = max(z for _, _, z in all_slots)
        idx = next(i for i in range(len(all_slots) - 1, -1, -1) if all_slots[i][2] == top)
        all_slots.pop(idx)

    # 目标块数：后期明显更多
    target = 21 + tier * 9 + min(24, (level_id - 1) * 2)
    target = pad_to_multiple_of_3(target)
    guard = 0
    while len(all_slots) < target and guard < 320:
        guard += 1
        c, r, L = rng.choice(all_slots)
        nl = L + 1
        if nl > max_layer:
            continue
        if any(x == c and y == r and z == nl for x, y, z in all_slots):
            continue
        all_slots.append((c, r, nl))
    while len(all_slots) % 3 != 0:
        all_slots.pop()

    types = unlocked_types(level_id)
    # 后期用满更多种类，降低「同色扎堆」概率
    type_span = min(len(types), 4 + tier)
    active = types[:type_span]
    bag: list[str] = []
    groups = len(all_slots) // 3
    for i in range(groups):
        t = active[i % len(active)]
        bag.extend([t, t, t])
    # 再打散组序，避免同型连续出现在同一层
    triples = [bag[i : i + 3] for i in range(0, len(bag), 3)]
    rng.shuffle(triples)
    bag = [x for tri in triples for x in tri]
    rng.shuffle(bag)

    all_slots.sort(key=lambda t: (t[2], t[1], t[0]))
    tiles = []
    for i, (c, r, L) in enumerate(all_slots):
        tiles.append({'type': bag[i], 'col': c, 'row': r, 'layer': L})
    return tiles


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    alphabet = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    for level_id in range(1, 31):
        if level_id <= 26:
            letter = alphabet[level_id - 1]
            thick = False
        else:
            letter = EXTRA[level_id - 27]
            thick = True
        tiles = build_tiles(letter, level_id, thick)
        poem_title = POEM_TITLES[level_id - 1]
        title = f'{poem_title} · {letter}'
        data = {
            'id': level_id,
            'title': title,
            'letter': letter,
            'poem': poem_title,
            'difficulty': difficulty_tier(level_id),
            'tiles': tiles,
        }
        path = OUT / f'level{level_id}.json'
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        layers = max((t['layer'] for t in tiles), default=0)
        kinds = len({t['type'] for t in tiles})
        print(f'level{level_id}: {letter} tier={data["difficulty"]} tiles={len(tiles)} layers≤{layers} kinds={kinds}')
    print('done', OUT)


if __name__ == '__main__':
    main()
