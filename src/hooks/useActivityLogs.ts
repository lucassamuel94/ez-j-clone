import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchActivityLogs, createActivityLog, ActionType } from '@/services/activityLogService';

// Hook to fetch activity logs for a lead
export const useActivityLogs = (leadId: string | null) => {
  return useQuery({
    queryKey: ['activityLogs', leadId],
    queryFn: () => fetchActivityLogs(leadId!),
    enabled: !!leadId,
  });
};

// Hook to create an activity log
export const useCreateActivityLog = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createActivityLog,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activityLogs', data.lead_id] });
    },
  });
};

// Helper hook for logging lead changes — memoized to prevent re-render cascades
export const useLogLeadActivity = () => {
  const createLog = useCreateActivityLog();

  const logActivity = useCallback(async (params: {
    lead_id: string;
    action_type: ActionType;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    description: string;
  }) => {
    try {
      await createLog.mutateAsync(params);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }, [createLog]);

  return { logActivity, isLogging: createLog.isPending };
};
