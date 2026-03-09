import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    let debounceTimer = null;

    async function loadProjects() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at');
      if (error) console.error('Fetch projects error:', error);
      setProjects(data || []);
      setLoading(false);
      clearTimeout(timeout);
    }

    // Debounce realtime refetches — if multiple project changes arrive in
    // quick succession, only one DB round-trip is made.
    function debouncedLoad() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadProjects, 300);
    }

    loadProjects();

    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, debouncedLoad)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const createProject = useCallback(async (project) => {
    // Do the insert without chaining .select() — the chained insert+select
    // pattern can hang on some Supabase project configs. Instead we insert,
    // then do a plain SELECT to pick up the new row.
    const { error } = await supabase
      .from('projects')
      .insert(project);
    if (error) {
      console.error('Create project error:', error);
      console.error('Details:', error?.details, '| Hint:', error?.hint, '| Code:', error?.code);
      throw error;
    }
    // Refetch the full list so local state stays in sync
    const { data: refreshed, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at');
    if (fetchError) console.error('Post-create fetch error:', fetchError);
    setProjects(refreshed || []);
  }, []);

  const updateProject = useCallback(async (id, updates) => {
    // Single round-trip: update + return the updated row immediately.
    // Avoids the previous two-call pattern that could exceed the modal's
    // 12-second safety timeout on slower connections.
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Update project error:', error);
      console.error('Details:', error?.details, '| Hint:', error?.hint, '| Code:', error?.code);
      throw error;
    }
    // Patch local state immediately so the UI reflects the change right away
    setProjects(prev => prev.map(p => p.id === id ? data : p));
    return data;
  }, []);

  const deleteProject = useCallback(async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { console.error('Delete project error:', error); return; }
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  return { projects, loading, createProject, updateProject, deleteProject };
}
