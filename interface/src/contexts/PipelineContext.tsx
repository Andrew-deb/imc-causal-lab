import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api, PipelineJob, QueueStatus } from "../lib/api";
import { useToast } from "@/hooks/use-toast";

interface PipelineContextType {
  activeJob: PipelineJob | null;
  queueStatus: QueueStatus | null;
  jobs: PipelineJob[];
  loading: boolean;
  refreshJobs: (sessionId?: string) => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  startStreaming: (jobId: string) => void;
  cancelJob: (jobId: string) => Promise<void>;
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined);

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeJob, setActiveJob] = useState<PipelineJob | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingJobIdRef = useRef<string | null>(null);

  const refreshQueueStatus = async () => {
    try {
      const status = await api.getQueueStatus();
      setQueueStatus(status);
    } catch (e) {
      console.error("Failed to fetch queue status:", e);
    }
  };

  const refreshJobs = async (sessionId?: string) => {
    setLoading(true);
    try {
      const list = await api.getPipelineJobs(sessionId);
      setJobs(list);
      
      const active = list.find(j => j.status === "running" || j.status === "queued");
      if (active) {
        setActiveJob(active);
        startStreaming(active.job_id);
      } else {
        setActiveJob(null);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        streamingJobIdRef.current = null;
      }
    } catch (e) {
      console.error("Failed to fetch jobs:", e);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = (jobId: string) => {
    if (streamingJobIdRef.current === jobId) {
      console.log(`Already streaming job ${jobId}, skipping duplicate connection.`);
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    streamingJobIdRef.current = jobId;
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://imc-causal-lab.onrender.com/api/v1";
    const sseUrl = `${API_BASE}/pipeline/stream/${jobId}`;
    console.log(`Connecting to SSE: ${sseUrl}`);
    
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const jobData = JSON.parse(event.data) as PipelineJob;
        setActiveJob(jobData);
        
        // Update job in the list
        setJobs(prev => {
          const exists = prev.some(j => j.job_id === jobData.job_id);
          if (exists) {
            return prev.map(j => j.job_id === jobData.job_id ? jobData : j);
          } else {
            return [jobData, ...prev];
          }
        });

        if (jobData.status === "completed") {
          toast({
            title: `Pipeline Finished ✅`,
            description: `${jobData.pipeline_type === "causal" ? "Causal modeling" : "Evaluation"} completed successfully.`,
          });
          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
            streamingJobIdRef.current = null;
          }
          setActiveJob(null);
          refreshQueueStatus();
          refreshJobs();
        } else if (jobData.status === "failed") {
          toast({
            title: `Pipeline Failed ❌`,
            description: jobData.error || "An unexpected error occurred during execution.",
            variant: "destructive",
          });
          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
            streamingJobIdRef.current = null;
          }
          setActiveJob(null);
          refreshQueueStatus();
          refreshJobs();
        } else if (jobData.status === "cancelled" || jobData.status === "interrupted") {
          toast({
            title: `Pipeline Terminated ⚠️`,
            description: `Job was ${jobData.status}.`,
            variant: "destructive",
          });
          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
            streamingJobIdRef.current = null;
          }
          setActiveJob(null);
          refreshQueueStatus();
          refreshJobs();
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    es.onerror = (err) => {
      console.error("SSE Connection error:", err);
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
        streamingJobIdRef.current = null;
      }
      setActiveJob(null);
    };
  };

  const cancelJob = async (jobId: string) => {
    try {
      await api.cancelPipelineJob(jobId);
      toast({
        title: "Cancellation Sent",
        description: `Job ${jobId.substring(0, 8)} cancellation request submitted.`,
      });
      // If streaming this job, close it
      if (activeJob?.job_id === jobId) {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        streamingJobIdRef.current = null;
        setActiveJob(null);
      }
      refreshQueueStatus();
      refreshJobs();
    } catch (e) {
      console.error("Failed to cancel job:", e);
      toast({
        title: "Cancellation Failed",
        description: e instanceof Error ? e.message : "Error cancelling job.",
        variant: "destructive",
      });
    }
  };

  // Poll queue status every 5 seconds
  useEffect(() => {
    refreshQueueStatus();
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // On mount, list jobs
  useEffect(() => {
    refreshJobs();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      streamingJobIdRef.current = null;
    };
  }, []);

  return (
    <PipelineContext.Provider
      value={{
        activeJob,
        queueStatus,
        jobs,
        loading,
        refreshJobs,
        refreshQueueStatus,
        startStreaming,
        cancelJob,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
};

export const usePipeline = () => {
  const context = useContext(PipelineContext);
  if (context === undefined) {
    throw new Error("usePipeline must be used within a PipelineProvider");
  }
  return context;
};
