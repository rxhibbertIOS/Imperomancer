import { holdPaired, openPairedWorkflow, savePairedWorkflow, showDmCard, updateDmAndSync, workflowPacing } from '../paired-workflows.js';

const definitions = [
    ['dice', 'dice', { rollMode: 'private', diceNotation: '1d20+7', diceMessage: 'Hidden perception', showResultModal: true, lastResult: { tag: 'Private Roll', notation: '1d20+7', total: 24, breakdown: '17 + 7 = 24', diceResults: [{ value: 17 }], message: 'Hidden perception', critical: false, fail: false } }, { rollMode: 'public', diceNotation: '2d100kh1+10d20cs>19+4d6', diceMessage: 'Arcane barrage', showResultModal: false, rollHistory: [{ id: 'dice-step', time: 1700000000000, rollMode: 'public', roller: 'DM', name: 'Arcane barrage', notation: '2d100kh1+10d20cs>19+4d6', total: 42, critical: false, fail: false }] }],
    ['fog', 'fog', { fogEnabled: true, fogEditing: true, fogTool: 'reveal', fogBrushCells: 5, fogStrokes: [] }, { fogTool: 'paint', fogStrokes: [{ mode: 'paint', shape: 'round', size: 5, x: 380, y: 420 }] }],
    ['grid', 'grid', { gridVisible: true, gridType: 'hex-pointy', scenePxPerCell: 18, gridCellsAcross: 100 }, { locked: true, tablePpi: 40 }],
    ['whiteboard', 'whiteboard', { whiteboardActive: true, whiteboardStrokes: [] }, { whiteboardActive: true, whiteboardStrokes: [{ tool: 'arrow', color: '#3b82f6', size: 10, points: [{ x: .15, y: .2 }, { x: .68, y: .62 }] }] }],
    ['initiative', 'initiative', { initiativeActive: true, combatants: [{ id: 'aria', name: 'Aria Vale', initiative: 22, isPlayer: true, isDead: false }, { id: 'guard', name: 'Forge Guard', initiative: 18, isPlayer: false, isDead: false }], currentTurn: 0, round: 1, showInitiative: true }, { initiativeCollapsed: true, currentTurn: 1, round: 2 }],
    ['pointer', 'pointer', { focusPings: [{ id: 'step-one', sceneX: 430, sceneY: 330, color: '#ffcc00', createdAt: 1700000000000 }] }, { focusPings: [{ id: 'step-one', sceneX: 430, sceneY: 330, color: '#ffcc00', createdAt: 1700000000000 }, { id: 'step-two', sceneX: 1040, sceneY: 560, color: '#a855f7', createdAt: 1700000001000 }] }],
    ['status', 'status', { combatants: [{ id: 'aria', name: 'Aria Vale', initiative: 22, isPlayer: true, isDead: false }], showInitiative: true, statusText: '⚔️ COMBAT START!', statusVisible: true }, { statusText: '💀 CRITICAL MISS!', statusVisible: true, round: 2 }],
    ['shapes', 'effects', { gridVisible: true, locked: true, scenePxPerCell: 100, measurement: { kind: 'line', anchor: { x: 240, y: 270 }, endpoint: { x: 700, y: 270 } } }, { effects: [{ id: 'silence', geometry: { kind: 'circle', anchor: { x: 1080, y: 370 }, endpoint: { x: 1220, y: 370 } }, color: '#000000', opacity: .45, label: 'Silence', visibility: 'public', persistent: true, showDistance: true }] }],
];
const assets = definitions.flatMap(([name]) => [`dm-e2e-${name}-01-configure.webm`, `player-e2e-${name}-01-configure.webm`, `dm-e2e-${name}-02-apply.webm`, `player-e2e-${name}-02-apply.webm`]);

/** Captures numbered paired chapters for every non-scene tool workflow. @type {import('../index.js').DocumentationCapture} */
export const featureStepsCapture = { id: 'feature-steps', title: 'captures synchronized numbered feature workflow chapters', assets, async run({ browser }) {
    const selected = new Set((process.env.DOCS_MEDIA_STEP_FEATURES || 'all').split(','));
    for (const [name, card, setup, action] of definitions.filter(([id]) => selected.has('all') || selected.has(id))) {
        for (const [number, label, patch] of [['01', 'configure', setup], ['02', 'apply', action]]) {
            const session = await openPairedWorkflow(browser);
            await showDmCard(session.dm, card);
            await holdPaired(session.dm, session.player, workflowPacing.before);
            await updateDmAndSync(session.dm, patch);
            await holdPaired(session.dm, session.player, workflowPacing.action + workflowPacing.after);
            await savePairedWorkflow(session, `dm-e2e-${name}-${number}-${label}.webm`, `player-e2e-${name}-${number}-${label}.webm`);
        }
    }
} };
