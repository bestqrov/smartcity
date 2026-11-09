/**
 * One-off migration: parents had no branch, so every school's staff could see all of them.
 * Gives each parent the branch of their children.
 *
 *   npx ts-node --transpile-only scripts/backfill-parent-branch.ts           # dry run, prints the plan
 *   npx ts-node --transpile-only scripts/backfill-parent-branch.ts --apply   # writes it
 *
 * - children all in one branch  → parent gets that branch
 * - children in several branches → parent gets the branch with most children; listed so the
 *   other school can create its own parent record and relink its children
 * - no children                  → left without branch (invisible to staff), listed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
    const parents = await prisma.parent.findMany({
        where: { OR: [{ branchId: null }, { branchId: { isSet: false } }] },
        select: { id: true, name: true, students: { select: { id: true, branchId: true } } },
    });

    console.log(`${parents.length} parent(s) without a branch${apply ? '' : ' — DRY RUN, nothing written (use --apply)'}`);

    let assigned = 0;
    const orphans: string[] = [];
    const split: string[] = [];

    for (const parent of parents) {
        if (parent.students.length === 0) {
            orphans.push(`${parent.id} ${parent.name}`);
            continue;
        }

        const counts = new Map<string, number>();
        parent.students.forEach((s) => counts.set(s.branchId, (counts.get(s.branchId) || 0) + 1));
        const [branchId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

        if (counts.size > 1) {
            split.push(`${parent.id} ${parent.name} → ${branchId} (children in ${[...counts.keys()].join(', ')})`);
        }

        if (apply) {
            await prisma.parent.update({ where: { id: parent.id }, data: { branchId } });
        }
        assigned += 1;
    }

    console.log(`${assigned} parent(s) ${apply ? 'assigned' : 'would be assigned'} to their children's branch`);
    if (split.length) console.log(`\n⚠️  Children in several branches (kept the main one):\n  ${split.join('\n  ')}`);
    if (orphans.length) console.log(`\nℹ️  No children, left without branch (hidden from staff):\n  ${orphans.join('\n  ')}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
