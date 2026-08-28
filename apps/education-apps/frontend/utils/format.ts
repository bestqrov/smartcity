export const formatCurrency = (num: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(num);
