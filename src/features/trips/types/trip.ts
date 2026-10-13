export const supportedCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'] as const;

export type Currency = (typeof supportedCurrencies)[number];

export type Trip = {
  id: string;
  title: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: {
    amount: number;
    currency: Currency;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateTripInput = Pick<Trip, 'origin' | 'destination' | 'startDate' | 'endDate' | 'travelers' | 'budget'>;
