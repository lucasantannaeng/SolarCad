import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ModuleData, InverterData } from '@/types';

export const useEquipment = () => {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [inverters, setInverters] = useState<InverterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [modRes, invRes] = await Promise.all([
        supabase.from('modules').select('*').order('brand').order('power'),
        supabase.from('inverters').select('*').order('brand').order('power'),
      ]);

      if (modRes.data) {
        setModules(modRes.data.map(m => ({
          id: m.id,
          brand: m.brand,
          model: m.model,
          power: Number(m.power),
          voc: Number(m.voc),
          isc: Number(m.isc),
          vmp: Number(m.vmp),
          imp: Number(m.imp),
        })));
      }

      if (invRes.data) {
        setInverters(invRes.data.map(i => ({
          id: i.id,
          brand: i.brand,
          model: i.model,
          power: Number(i.power),
          maxDcVoltage: Number(i.max_dc_voltage),
          maxInputCurrent: Number(i.max_input_current),
          mpptMin: Number(i.mppt_min),
          mpptMax: Number(i.mppt_max),
          mpptCount: i.mppt_count,
          nominalOutputVoltage: i.nominal_output_voltage,
          outputPhases: i.output_phases ?? 1,
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  return { modules, inverters, loading };
};
