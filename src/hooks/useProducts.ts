import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Product {
  id: string;
  category: string;
  name: string;
  price: number;
  messages_included: number;
  contacts_included: number;
  excess_message_price: number;
  excess_contact_price: number;
  description: string | null;
  active: boolean;
  recommended: boolean;
  sort_order: number;
  min_extensions: number | null;
  max_extensions: number | null;
  price_per_extension: number | null;
  custom_pricing: boolean | null;
  features: string[] | null;
  subcategory: string | null;
  frequency: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
export type ProductUpdate = Partial<ProductInsert> & { id: string };

export const useProducts = (category: string) => {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', category)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (product: Omit<ProductInsert, 'sort_order'>) => {
      const maxOrder = products.length > 0 ? Math.max(...products.map(p => p.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, sort_order: maxOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', category] });
      toast.success('Plano criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar plano'),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: ProductUpdate) => {
      const { error } = await supabase.from('products').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', category] });
      toast.success('Plano atualizado com sucesso');
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', category] });
      toast.success('Plano excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir plano'),
  });

  return { products, isLoading, createProduct, updateProduct, deleteProduct };
};
