/**
 * The whole toolset for the AI Sales Agent (task G11). Every tool already exists (CRM tools R18, scheduling
 * tools S02, qualification capture R19, callbacks R21, FAQ R17, call memory R15); this assembles them from
 * injected dependencies so the agent definition and the real tools can be checked against each other without a
 * database. Nothing is registered anywhere by calling it.
 */
import type { AgentTool } from "./agentRuntime";
import { callContextTools, type CallContextStore } from "./callContext";
import { callbackTool, type CallbackToolDeps } from "./callbackTools";
import { crmTools, type CrmDeps } from "./crmTools";
import { discoveryCaptureTool, type CaptureDeps } from "./discoveryCapture";
import { faqTools, type FaqDeps } from "./faqStore";
import { knowledgeTools, type KnowledgeDeps } from "./knowledgeStore";
import { schedulingTools, type SchedulingDeps } from "./schedulingTools";

export function salesAgentToolset(d: { faq: FaqDeps; knowledge: KnowledgeDeps; crm: CrmDeps; scheduling: SchedulingDeps; capture: CaptureDeps; callback: CallbackToolDeps; context: CallContextStore }): AgentTool[] {
  const knowledge = knowledgeTools(d.knowledge).filter((t) => t.name === "search_knowledge_base_articles" || t.name === "search_product_documentation");
  return [...faqTools(d.faq), ...knowledge, ...crmTools(d.crm), discoveryCaptureTool(d.capture), ...schedulingTools(d.scheduling), callbackTool(d.callback), ...callContextTools(d.context)];
}
