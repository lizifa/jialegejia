import {
    BlockInputEvents,
    EventTouch,
    Graphics,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { addLabel, colorFromHex, makeNode } from './UIKit';

export type SignaturePadHandle = {
    root: Node;
    hasInk: () => boolean;
    clear: () => void;
    setLocked: (locked: boolean) => void;
    isLocked: () => boolean;
    getStrokes: () => InkStroke[];
    padSize: { w: number; h: number };
};

type InkStroke = { x: number; y: number }[];
type Stroke = InkStroke;

/**
 * 签名式手写板：按住拖动画墨迹，松手结束一笔
 */
export function mountSignaturePad(
    parent: Node,
    w: number,
    h: number,
    opts?: { ink?: string; hint?: string },
): SignaturePadHandle {
    const inkHex = opts?.ink ?? '#2F2118';
    const root = makeNode('signPad', parent, w, h);
    if (!root.getComponent(BlockInputEvents)) root.addComponent(BlockInputEvents);

    const bg = root.addComponent(Graphics);
    const paintChrome = () => {
        bg.clear();
        bg.fillColor = colorFromHex('#FFFCF7', 255);
        bg.roundRect(-w * 0.5, -h * 0.5, w, h, 16);
        bg.fill();
        bg.strokeColor = colorFromHex('#E8C9A0', 210);
        bg.lineWidth = 2;
        bg.roundRect(-w * 0.5, -h * 0.5, w, h, 16);
        bg.stroke();
        bg.strokeColor = colorFromHex('#D4B896', 110);
        bg.lineWidth = 1.2;
        bg.roundRect(-w * 0.5 + 10, -h * 0.5 + 10, w - 20, h - 20, 12);
        bg.stroke();
        // 田字格淡线，方便写字
        bg.strokeColor = colorFromHex('#E8D8C0', 90);
        bg.lineWidth = 1;
        bg.moveTo(0, -h * 0.5 + 18);
        bg.lineTo(0, h * 0.5 - 18);
        bg.moveTo(-w * 0.5 + 18, 0);
        bg.lineTo(w * 0.5 - 18, 0);
        bg.stroke();
    };
    paintChrome();

    const hintLab = addLabel(
        root,
        'padHint',
        opts?.hint ?? '在此手写谜底',
        18,
        '#C4A88A',
        w - 40,
        28,
        true,
    );
    hintLab.node.setPosition(0, 0, 0);

    const layer = makeNode('inkLayer', root, w, h);
    const g = layer.addComponent(Graphics);

    const strokes: Stroke[] = [];
    let cur: Stroke | null = null;
    let locked = false;
    const ui = root.getComponent(UITransform)!;

    const toLocal = (e: EventTouch) => {
        const loc = e.getUILocation();
        return ui.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
    };

    const inBounds = (p: Vec3) =>
        Math.abs(p.x) <= w * 0.5 - 10 && Math.abs(p.y) <= h * 0.5 - 10;

    const redrawInk = () => {
        g.clear();
        g.strokeColor = colorFromHex(inkHex, 235);
        g.fillColor = colorFromHex(inkHex, 235);
        g.lineWidth = 6;
        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;
        for (const s of strokes) {
            if (s.length === 0) continue;
            if (s.length === 1) {
                g.circle(s[0]!.x, s[0]!.y, 3);
                g.fill();
                continue;
            }
            g.moveTo(s[0]!.x, s[0]!.y);
            for (let i = 1; i < s.length; i++) {
                g.lineTo(s[i]!.x, s[i]!.y);
            }
            g.stroke();
        }
        hintLab.node.active = strokes.length === 0;
    };

    root.on(
        Node.EventType.TOUCH_START,
        (e: EventTouch) => {
            if (locked) return;
            e.propagationStopped = true;
            const p = toLocal(e);
            if (!inBounds(p)) return;
            cur = [{ x: p.x, y: p.y }];
            strokes.push(cur);
            redrawInk();
        },
        root,
    );

    root.on(
        Node.EventType.TOUCH_MOVE,
        (e: EventTouch) => {
            if (locked || !cur) return;
            e.propagationStopped = true;
            const p = toLocal(e);
            if (!inBounds(p)) return;
            const last = cur[cur.length - 1]!;
            if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
            cur.push({ x: p.x, y: p.y });
            redrawInk();
        },
        root,
    );

    root.on(
        Node.EventType.TOUCH_END,
        (e: EventTouch) => {
            e.propagationStopped = true;
            cur = null;
        },
        root,
    );
    root.on(Node.EventType.TOUCH_CANCEL, () => {
        cur = null;
    });

    return {
        root,
        hasInk: () => strokes.some((s) => s.length > 0),
        clear: () => {
            strokes.length = 0;
            cur = null;
            locked = false;
            redrawInk();
        },
        setLocked: (v: boolean) => {
            locked = v;
            cur = null;
        },
        isLocked: () => locked,
        getStrokes: () => strokes.map((s) => s.map((p) => ({ x: p.x, y: p.y }))),
        padSize: { w, h },
    };
}
