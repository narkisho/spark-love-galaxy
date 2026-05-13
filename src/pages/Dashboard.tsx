import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { LogOut } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { QuestionInput } from "@/components/dashboard/QuestionInput";
import { ConversationHistory } from "@/components/dashboard/ConversationHistory";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session:", session);
      if (!session) {
        navigate("/");
      } else {
        // Fetch previous conversations
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching conversations:', error);
          toast({
            title: "Error",
            description: "Failed to load previous conversations",
            variant: "destructive",
          });
        } else {
          setConversations(data || []);
        }
      }
    };
    
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed in dashboard:", event, session);
      if (event === 'SIGNED_OUT' || !session) {
        navigate("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleAskQuestion = async (question: string) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No user session');

      // Get the last conversation to provide context
      const lastConversation = conversations[0];
      const context = lastConversation ? {
        previousQuestion: lastConversation.question,
        previousAnswer: lastConversation.answer
      } : null;

      const { data, error } = await supabase.functions.invoke('ask-spark-revive', {
        body: { 
          question,
          userId: session.user.id,
          context // Pass the context to maintain conversation flow
        },
      });

      if (error) throw error;

      // Refresh conversations
      const { data: newConversations, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setConversations(newConversations || []);
      
      toast({
        title: "Success",
        description: "Your question has been answered!",
      });
    } catch (error) {
      console.error("Error asking question:", error);
      toast({
        title: "Error",
        description: "Failed to get an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatAnswer = (answer: string) => (
    <div className="prose prose-sm md:prose-base max-w-none prose-headings:text-spark-rose prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-spark-text prose-p:leading-relaxed prose-strong:text-spark-rose prose-strong:font-semibold prose-em:text-spark-purple prose-a:text-spark-rose hover:prose-a:text-spark-purple prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-blockquote:border-spark-rose prose-blockquote:text-spark-text-light prose-code:text-spark-purple prose-code:bg-spark-rose/10 prose-code:px-1 prose-code:rounded">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-gradient">Welcome to Your Dashboard</h1>
            <p className="text-spark-text-light text-lg max-w-2xl">
              Start exploring SparkRevive's features to enhance your relationship.
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={signOut}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Ask Spark Revive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuestionInput 
              onAskQuestion={handleAskQuestion}
              isLoading={isLoading}
            />
            <ConversationHistory 
              conversations={conversations}
              formatAnswer={formatAnswer}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Dashboard;