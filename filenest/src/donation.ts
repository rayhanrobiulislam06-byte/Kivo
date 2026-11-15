// To accept TRX instead of USDT, change currency below.
export const DONATION = {
  enabled: true,
  currency: 'USDT',
  suggestedAmounts: [1, 5, 10, 25],
  methods: [
    {
      id: 'tron',
      enabled: true,
      label: 'TRON network (TRC-20)',
      address: 'TE5jGt6oHhyfYU4kiUTsXCC2t35hctRM45',
      network: 'TRON (TRC-20)',
      instructions: 'Send only on the TRON (TRC-20) network. Other networks may cause permanent loss of funds.',
    },
  ],
}
