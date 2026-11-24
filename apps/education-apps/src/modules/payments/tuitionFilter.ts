// Transport fees are stored as Payment rows too (transportSubscriptionId set). Anything that
// treats a student's payments as tuition — balances, receipts, portals — must use this filter.
export const tuitionPayments = { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } };
// The balance due is sum(inscriptions) − payments WITHOUT forMonth: monthly tuition (school mode,
// forMonth set) is tracked by the dues, not by the inscriptions. Legacy schools never set forMonth.
export const balancePayments = { OR: [{ forMonth: null }, { forMonth: { isSet: false } }] };
