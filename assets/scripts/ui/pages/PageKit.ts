import { Node, SpriteFrame, UITransform } from 'cc';
import { Colors, Design } from '../../core/Config';
import { getSafeLayout, SafeLayout } from '../../core/SafeArea';
import { addCircleBtn, addLabel, makeNode } from '../UIKit';

/** 装饰层不吃点击 */
export function disableHit(node: Node) {
    const ui = node.getComponent(UITransform);
    if (ui) {
        (ui as UITransform & { hitTest?: (p: unknown) => boolean }).hitTest = () => false;
    }
    node.children.forEach((c) => disableHit(c));
}

/** 挂载页面根节点（各 Page 组件共用） */
export function mountPageRoot(parent: Node, name: string): Node {
    return makeNode(name, parent, Design.width, Design.height);
}

/** 二级页顶栏：避开刘海/胶囊 */
export function placePageHeader(
    parent: Node,
    title: string,
    onBack: () => void,
    opts?: { safe?: SafeLayout; backFrame?: SpriteFrame },
): SafeLayout {
    const s = opts?.safe ?? getSafeLayout();
    const btnSize = s.headerBtnSize;
    const y = s.headerY;
    addCircleBtn(parent, 'back', '←', btnSize, onBack, opts?.backFrame).setPosition(-300, y, 0);
    addLabel(parent, 'title', title, 36, Colors.brown, 400, 50, true).node.setPosition(0, y, 0);
    return s;
}
