import { useState, useEffect } from 'react';
import { getCapitalOverview, getMyInvestments } from '../api/investor.api';
import type { CapitalOverview } from '../types/investor.types';
import type { InvestmentHistoryItem } from '../api/investor.api';

export function useInvestorDashboard() {
  const [data, setData] = useState<CapitalOverview | null>(null);
  const [investments, setInvestments] = useState<InvestmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const [capitalRes, investmentsRes] = await Promise.all([
        getCapitalOverview(),
        getMyInvestments(),
      ]);
      setData(capitalRes);
      setInvestments(investmentsRes);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Significa que no ha creado su perfil aún
        setError('No tienes perfil de donador.');
      } else {
        setError('Error al cargar datos financieros.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return {
    data,
    investments,
    loading,
    error,
    refetch: fetchOverview,
  };
}
