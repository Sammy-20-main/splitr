/**
 * calculateBalances
 * Given a list of expenses with splits, returns each member's
 * net balance relative to the current user.
 * Positive = they owe you | Negative = you owe them
 */
export function calculateBalances(expenses, currentUserId) {
  const net = {} // userId -> net amount

  expenses.forEach(expense => {
    const payerId = expense.paid_by
    const splits = expense.expense_splits || []

    splits.forEach(split => {
      if (split.settled) return

      const debtorId = split.user_id
      if (payerId === debtorId) return // payer's own share, skip

      // debtorId owes payerId this amount
      if (payerId === currentUserId) {
        // someone owes me
        net[debtorId] = (net[debtorId] || 0) - split.amount
      } else if (debtorId === currentUserId) {
        // I owe someone
        net[payerId] = (net[payerId] || 0) + split.amount
      }
    })
  })

  // We need names — they come from the profiles join in expenses
  // Build a name map from expense data
  const nameMap = {}
  expenses.forEach(exp => {
    if (exp.profiles) nameMap[exp.paid_by] = exp.profiles.name
  })

  return Object.entries(net)
    .filter(([, amount]) => Math.abs(amount) > 0.01)
    .map(([userId, amount]) => ({
      userId,
      name: nameMap[userId] || 'unknown',
      amount: Math.round(amount * 100) / 100,
    }))
}

/**
 * simplifyDebts
 * Takes an array of { userId, name, netBalance } objects
 * Returns minimum transactions needed to settle all debts
 * netBalance > 0 means they are owed money (creditor)
 * netBalance < 0 means they owe money (debtor)
 */
export function simplifyDebts(memberBalances) {
  const balances = memberBalances
    .map(m => ({ ...m, net: m.netBalance }))
    .filter(m => Math.abs(m.net) > 0.01)

  const transactions = []

  // separate into creditors and debtors
  const creditors = balances.filter(b => b.net > 0).sort((a, b) => b.net - a.net)
  const debtors = balances.filter(b => b.net < 0).sort((a, b) => a.net - b.net)

  let i = 0, j = 0

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]

    const amount = Math.min(creditor.net, -debtor.net)
    amount > 0.01 && transactions.push({
      from: debtor,
      to: creditor,
      amount: Math.round(amount * 100) / 100,
    })

    creditor.net -= amount
    debtor.net += amount

    if (Math.abs(creditor.net) < 0.01) i++
    if (Math.abs(debtor.net) < 0.01) j++
  }

  return transactions
}

/**
 * getGroupNetBalances
 * For a group's expenses, compute each member's net balance
 * Positive = owed money | Negative = owes money
 */
export function getGroupNetBalances(expenses) {
  const net = {} // userId -> { name, net }

  expenses.forEach(expense => {
    const payerId = expense.paid_by
    const payerName = expense.profiles?.name || 'unknown'
    const splits = expense.expense_splits || []

    if (!net[payerId]) net[payerId] = { name: payerName, netBalance: 0 }
    net[payerId].netBalance += Number(expense.amount)

    splits.forEach(split => {
      const uid = split.user_id
      if (!net[uid]) net[uid] = { name: 'member', netBalance: 0 }
      net[uid].netBalance -= Number(split.amount)
    })
  })

  return Object.entries(net).map(([userId, data]) => ({
    userId,
    ...data,
    netBalance: Math.round(data.netBalance * 100) / 100,
  }))
}