import { useState, useEffect, useCallback } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { notifySlack } from '../lib/slack';

// ─── TEAM MEMBERS ───
export function useTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    async function loadTeam() {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at');
      if (error) console.error('Fetch team error:', error);
      setTeam(data || []);
      setLoading(false);
      clearTimeout(timeout);
    }
    loadTeam();
    return () => clearTimeout(timeout);
  }, []);

  return { team, loading };
}

// ─── TASKS ───
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    let debounceTimer = null;

    async function loadTasks() {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at');
      if (error) console.error('Fetch tasks error:', error);
      setTasks(data || []);
      setLoading(false);
      clearTimeout(timeout);
    }

    // Debounce realtime-triggered refetches so a burst of DB events
    // (e.g. dragging a card fires INSERT+UPDATE) only causes one fetch.
    function debouncedLoad() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadTasks, 300);
    }

    loadTasks(); // initial load — immediate

    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedLoad)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const updateTask = useCallback(async (id, updates, actorId) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) { console.error('Update task error:', error); throw error; }

    // Optimistic local update — realtime will confirm with a full refresh shortly
    setTasks(prev => prev.map(t => t.id === id ? data : t));

    if (updates.status && actorId) {
      logActivity(actorId, 'task_moved', 'task', id, {
        title: data.title,
        newStatus: updates.status,
      });
    }

    // Notify Slack when a task is marked done
    if (updates.status === 'done') {
      notifySlack('task_done', { task: data });
    }

    return data;
  }, []);

  const createTask = useCallback(async (task) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select('*')
      .single();

    if (error) { console.error('Create task error:', error); throw error; }
    setTasks(prev => [...prev, data]);
    return data;
  }, []);

  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) { console.error('Delete task error:', error); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, loading, updateTask, createTask, deleteTask };
}

// ─── DESIGNS ───
export function useDesigns() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    let debounceTimer = null;

    async function loadDesigns() {
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .order('created_at');
      if (error) { console.error('Fetch designs error:', error); }
      setDesigns(data || []);
      setLoading(false);
      clearTimeout(timeout);
    }

    function debouncedLoad() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadDesigns, 300);
    }

    loadDesigns();

    const channel = supabase
      .channel('designs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'designs' }, debouncedLoad)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const updateDesign = useCallback(async (id, updates, actorId) => {
    const { data, error } = await supabase
      .from('designs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) { console.error('Update design error:', error); return null; }
    setDesigns(prev => prev.map(d => d.id === id ? data : d));

    if (updates.status === 'listed' && actorId) {
      logActivity(actorId, 'design_listed', 'design', id, {
        name: data.name,
        platforms: data.platforms,
      });
    }

    // Notify Slack when a design goes live
    if (updates.status === 'listed') {
      notifySlack('design_listed', { design: data });
    }

    return data;
  }, []);

  const createDesign = useCallback(async (design) => {
    const { data, error } = await supabase
      .from('designs')
      .insert(design)
      .select('*')
      .single();

    if (error) { console.error('Create design error:', error); throw error; }
    setDesigns(prev => [...prev, data]);
    return data;
  }, []);

  const deleteDesign = useCallback(async (id) => {
    const { error } = await supabase.from('designs').delete().eq('id', id);
    if (error) { console.error('Delete design error:', error); return; }
    setDesigns(prev => prev.filter(d => d.id !== id));
  }, []);

  return { designs, loading, updateDesign, createDesign, deleteDesign };
}

// ─── DECISIONS ───
export function useDecisions() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    let debounceTimer = null;

    async function loadDecisions() {
      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .order('decision_date', { ascending: false });
      if (error) console.error('Fetch decisions error:', error);
      setDecisions(data || []);
      setLoading(false);
      clearTimeout(timeout);
    }

    function debouncedLoad() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadDecisions, 300);
    }

    loadDecisions();

    const channel = supabase
      .channel('decisions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, debouncedLoad)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const updateDecision = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('decisions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) { console.error('Update decision error:', error); return null; }
    setDecisions(prev => prev.map(d => d.id === id ? data : d));
    return data;
  }, []);

  const createDecision = useCallback(async (decision, actorId) => {
    const { data, error } = await supabase
      .from('decisions')
      .insert(decision)
      .select('*')
      .single();

    if (error) { console.error('Create decision error:', error); throw error; }
    setDecisions(prev => [data, ...prev]);

    if (actorId) {
      logActivity(actorId, 'decision_made', 'decision', data.id, {
        title: data.title,
        result: data.result,
        voteType: data.vote_type,
      });
    }

    // Notify Slack when a new decision is recorded
    notifySlack('decision_created', { decision: data });

    return data;
  }, []);

  const deleteDecision = useCallback(async (id) => {
    const { error } = await supabase.from('decisions').delete().eq('id', id);
    if (error) { console.error('Delete decision error:', error); return; }
    setDecisions(prev => prev.filter(d => d.id !== id));
  }, []);

  return { decisions, loading, updateDecision, createDecision, deleteDecision };
}

// ─── ACTIVITY LOG ───
export function useActivity(limit = 20) {
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    async function loadActivity() {
      const { data } = await supabase
        .from('activity_log')
        .select('*, actor:team_members(*)')
        .order('created_at', { ascending: false })
        .limit(limit);
      setActivity(data || []);
    }
    loadActivity();

    const channel = supabase
      .channel('activity-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        loadActivity();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  return activity;
}
