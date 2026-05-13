import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "@/types/closer-kit";
import { ActivityCard } from "./ActivityCard";

export function ActivityList() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from('closer_kit_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedActivities: Activity[] = data?.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        stage: item.stage,
        duration: item.duration,
        difficulty_level: item.difficulty_level,
        completed: item.completed,
        is_favorite: item.is_favorite,
        location: item.location,
        partner_roles: item.partner_roles as unknown as Activity['partner_roles']
      })) || [];

      setActivities(typedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error("Failed to load activities");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('closer_kit_activities')
        .update({ completed: !completed })
        .eq('id', id);

      if (error) throw error;
      await fetchActivities();
      toast.success(completed ? "Activity marked as incomplete" : "Activity completed!");
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error("Failed to update activity");
    }
  };

  const toggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('closer_kit_activities')
        .update({ is_favorite: !isFavorite })
        .eq('id', id);

      if (error) throw error;
      await fetchActivities();
      toast.success(isFavorite ? "Removed from favorites" : "Added to favorites!");
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error("Failed to update activity");
    }
  };

  if (isLoading) {
    return <div>Loading activities...</div>;
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-spark-text-light">No activities yet. Generate your first one!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onToggleComplete={toggleComplete}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </div>
  );
}