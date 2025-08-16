import OpenAI from "openai";

import type { AssistantStream } from "openai/lib/AssistantStream.mjs";

import type { Channel, Event, MessageResponse, StreamChat } from "stream-chat";

export class OpenAiResponseHandler {
  private message_text = "";
  private chunk_counter = 0;
  private run_id = "";
  private is_done = false;
  private last_update_time = 0;

  constructor(
    private readonly openai: OpenAI,
    private readonly openAiThread: OpenAI.Beta.Threads.Thread,
    private readonly assistantStream: AssistantStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
    private readonly onDispose: () => void
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStopGenerating);
  }
  run = async () => {};
  dispose = async () => {};
  private handleStopGenerating = async (event: Event) => {
    if (this.is_done || event.message_id) {
      return;
    }
    console.log("Stop generating for message", this.message.id);
    if (!this.openai || !this.openAiThread) {
      return;
    }
    try {
      await this.openai.beta.threads.runs.cancel(this.run_id, {
        thread_id: this.openAiThread.id,
      });
    } catch (error) {
      console.error("Error cancelling run", error);
    }
    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.dispose();
  };
  private handleStreamEvent = async (event: Event) => {};
  private handleError = async (event: Event) => {
    if (this.is_done) {
      return;
    }
    this.is_done = true;
    this.chatClient.off("ai_indicator.stop", this.handleStopGenerating);
    this.onDispose;
    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_ERROR",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: {
        text:
          typeof event.message === "string"
            ? event.message
            : "Error generating the message",
      },
    });
    await this.dispose();
  };
  private performwebsearch = async (query: string): Promise<string> => {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!TAVILY_API_KEY)
      return JSON.stringify({
        error: "Web search is not available, api key not configured",
      });
    console.log(`Performing a web search for ${query}`);
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        }),
      });
      if (!response.ok) {
        const errorText = response.text();
        console.log(`Tavily search failed for query ${query}`, errorText);
        return JSON.stringify({
          error: `Search failed with status: ${response.status}`,
          details: errorText,
        });
      }
      const data = await response.json();
      console.log(`Tavily search successful for query: ${query}`);
      return JSON.stringify(data);
    } catch (error) {
      console.error(`An exception occured during web search for ${query}`);
      return JSON.stringify({
        error: "An error occured during the web search",
      });
    }
  };
}
