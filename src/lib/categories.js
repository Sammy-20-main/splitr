export const CATEGORIES = [
  { id: 'food',          label: 'Food & drink',        icon: '🍽️',  color: '#FF6B6B', bg: '#FF6B6B22' },
  { id: 'travel',        label: 'Travel & transport',  icon: '✈️',  color: '#4ECDC4', bg: '#4ECDC422' },
  { id: 'rent',          label: 'Rent & utilities',    icon: '🏠',  color: '#45B7D1', bg: '#45B7D122' },
  { id: 'shopping',      label: 'Shopping',            icon: '🛍️',  color: '#F7B731', bg: '#F7B73122' },
  { id: 'entertainment', label: 'Entertainment',       icon: '🎬',  color: '#A55EEA', bg: '#A55EEA22' },
  { id: 'health',        label: 'Health',              icon: '💊',  color: '#26de81', bg: '#26de8122' },
  { id: 'other',         label: 'Other',               icon: '📦',  color: '#778ca3', bg: '#778ca322' },
]

export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]
}