import { create } from 'zustand';
import type { UserRole } from '@/hooks/useUserRole';

interface RoleSimulationState {
  /** The role being simulated, or null if no simulation active */
  simulatedRole: UserRole | null;
  /** Whether the simulation is active */
  isSimulating: boolean;
  /** Start simulating a role */
  startSimulation: (role: UserRole) => void;
  /** Stop simulation and revert to real role */
  stopSimulation: () => void;
}

export const useRoleSimulation = create<RoleSimulationState>((set) => ({
  simulatedRole: null,
  isSimulating: false,
  startSimulation: (role) => set({ simulatedRole: role, isSimulating: true }),
  stopSimulation: () => set({ simulatedRole: null, isSimulating: false }),
}));
