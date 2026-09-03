import { formatCEP } from '@/hooks/useCompanyProfile';

export interface CepLookupResult {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  complement?: string;
}

/**
 * Consulta endereço a partir de CEP utilizando BrasilAPI com fallback para ViaCEP
 * @param rawCep CEP com ou sem formatação (8 dígitos)
 * @returns Objeto com dados do logradouro ou null caso não encontrado
 */
export async function fetchCepData(rawCep: string): Promise<CepLookupResult | null> {
  const clean = rawCep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  // 1. Tenta BrasilAPI v2 (dados enriquecidos com dados de logradouro e bairro)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data.city || data.street) {
        return {
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: (data.state || 'RJ').toUpperCase(),
          zipCode: formatCEP(data.cep || clean),
        };
      }
    }
  } catch (err) {
    // Fallback silencioso para ViaCEP
  }

  // 2. Fallback para ViaCEP
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: (data.uf || 'RJ').toUpperCase(),
          zipCode: formatCEP(data.cep || clean),
          complement: data.complemento || '',
        };
      }
    }
  } catch (err) {
    console.error('Erro ao consultar ViaCEP:', err);
  }

  return null;
}
