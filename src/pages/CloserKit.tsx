import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreferencesForm } from "@/components/closer-kit/PreferencesForm";
import { ActivityList } from "@/components/closer-kit/ActivityList";
import { ActivityForm } from "@/components/closer-kit/ActivityForm";
import { FlaskConical, ListChecks, Settings } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CloserKit = () => {
  const [activeTab, setActiveTab] = useState("new");
  const [hasPreferences, setHasPreferences] = useState(false);

  useEffect(() => {
    checkPreferences();
  }, []);

  const checkPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('closer_kit_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error checking preferences:', error);
        return;
      }

      // Check if we have any preferences at all
      setHasPreferences(data && data.length > 0);
    } catch (error) {
      console.error('Error checking preferences:', error);
    }
  };

  const onPreferencesSaved = () => {
    setHasPreferences(true);
    toast.success("Preferences saved! You can now generate activities.");
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gradient">CloserKit — Personalized Relationship Building Lab</h1>
          <p className="text-spark-text-light text-lg max-w-2xl mx-auto">
            Build deeper connections through personalized relationship exercises
          </p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="text-primary" />
              Relationship Building Lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="new">
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Generate New
                </TabsTrigger>
                <TabsTrigger value="activities">
                  <ListChecks className="w-4 h-4 mr-2" />
                  Activities
                </TabsTrigger>
                <TabsTrigger value="preferences">
                  <Settings className="w-4 h-4 mr-2" />
                  Preferences
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="mt-4">
                {!hasPreferences ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-spark-text-light mb-4">
                        Please set your preferences before generating activities
                      </p>
                      <PreferencesForm onSaved={onPreferencesSaved} />
                    </CardContent>
                  </Card>
                ) : (
                  <ActivityForm />
                )}
              </TabsContent>

              <TabsContent value="activities" className="mt-4">
                <ActivityList />
              </TabsContent>

              <TabsContent value="preferences" className="mt-4">
                <PreferencesForm onSaved={onPreferencesSaved} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default CloserKit;