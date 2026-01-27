from typing import List, Any, Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, SQLModel
from pydantic import BaseModel
from app.api.deps import get_session
from app.models.workflow import Workflow, WorkflowBase, Agent, Tool
import observix.agents as oa

router = APIRouter()

# --- Schemas ---

class WorkflowRunRequest(BaseModel):
    input: str
    config: Optional[Dict[str, Any]] = {}

class WorkflowRunResponse(BaseModel):
    result: Any

class WorkflowExportResponse(BaseModel):
    code: str

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph_data: Optional[Dict] = None
    is_published: Optional[bool] = None

# --- Endpoints ---

@router.get("/", response_model=List[Workflow])
async def read_workflows(
    skip: int = 0, 
    limit: int = 100, 
    is_published: Optional[bool] = None,
    session: AsyncSession = Depends(get_session)
) -> Any:
    """
    Retrieve workflows.
    """
    query = select(Workflow)
    if is_published is not None:
        query = query.where(Workflow.is_published == is_published)
    query = query.offset(skip).limit(limit).order_by(Workflow.updated_at.desc())
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/", response_model=Workflow)
async def create_workflow(workflow: WorkflowCreate, session: AsyncSession = Depends(get_session)) -> Any:
    """
    Create new workflow.
    """
    db_workflow = Workflow.from_orm(workflow)
    session.add(db_workflow)
    await session.commit()
    await session.refresh(db_workflow)
    return db_workflow

@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: UUID, workflow_update: WorkflowUpdate, session: AsyncSession = Depends(get_session)) -> Any:
    db_workflow = await session.get(Workflow, workflow_id)
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    update_data = workflow_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_workflow, key, value)
        
    db_workflow.updated_at = datetime.now(timezone.utc)
    
    session.add(db_workflow)
    await session.commit()
    await session.refresh(db_workflow)
    return db_workflow

@router.get("/{workflow_id}", response_model=Workflow)
async def read_workflow(
    *,
    session: AsyncSession = Depends(get_session),
    workflow_id: UUID
) -> Any:
    """
    Get workflow by ID.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.delete("/{workflow_id}", response_model=Workflow)
async def delete_workflow(
    *,
    session: AsyncSession = Depends(get_session),
    workflow_id: UUID
) -> Any:
    """
    Delete workflow.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await session.delete(workflow)
    await session.commit()
    return workflow

@router.post("/{workflow_id}/run", response_model=WorkflowRunResponse)
async def run_workflow(
    *,
    session: AsyncSession = Depends(get_session),
    workflow_id: UUID,
    request: WorkflowRunRequest
) -> Any:
    """
    Run a workflow.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # 1. Reconstruct Graph from workflow.graph_data
    graph_data = workflow.graph_data
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    
    # Map React Flow IDs to Graph Node Names
    # Agent nodes will be named by their DB name (or unique ID if name collision)
    
    # 1.1 Fetch all referenced Agents and Tools to minimize DB queries
    agent_node_ids = [n["data"]["id"] for n in nodes if n["type"] == "agent"]
    
    # Fetch Agents from DB
    stmt_agents = select(Agent).where(Agent.id.in_(agent_node_ids))
    result_agents = await session.execute(stmt_agents)
    db_agents = {str(a.id): a for a in result_agents.scalars().all()}
    
    # Fetch Tools needed by these agents
    all_tool_ids = set()
    for a in db_agents.values():
        all_tool_ids.update(a.tool_ids)
        
    stmt_tools = select(Tool).where(Tool.id.in_(all_tool_ids))
    result_tools = await session.execute(stmt_tools)
    db_tools = {str(t.id): t for t in result_tools.scalars().all()}
    
    # Fetch Providers for these agents
    from app.models.llm_provider import LLMProvider
    provider_ids = set(a.model_config_id for a in db_agents.values())
    stmt_providers = select(LLMProvider).where(LLMProvider.id.in_(provider_ids))
    result_providers = await session.execute(stmt_providers)
    db_providers = {str(p.id): p for p in result_providers.scalars().all()}

    # 1.2 Build Observix Objects
    oa_graph = oa.Graph(state=dict, name=workflow.name)
    
    node_mapping = {} # rf_id -> graph_node_name
    
    # Helper to create OA Tool
    def create_oa_tool(db_tool: Tool) -> oa.Tool:
        # For demo, creating a generic mock tool
        # In real world, this would map to actual implementations based on 'configuration'
        async def generic_tool_fn(**kwargs):
            return f"Executed tool {db_tool.name} with args: {kwargs}"
            
        return oa.Tool(
            fn=generic_tool_fn,
            name=db_tool.name,
            description=db_tool.description or "A tool"
        )

    # Cache created OA tools
    oa_tools_cache = {}

    for node in nodes:
        rf_id = node["id"]
        n_type = node["type"]
        
        if n_type == "start":
            node_mapping[rf_id] = oa.START
        elif n_type == "end":
            node_mapping[rf_id] = oa.END
        elif n_type == "agent":
            db_id = node["data"].get("id")
            db_agent = db_agents.get(db_id)
            if not db_agent:
                continue # Skip if agent not found in DB
            
            # Prepare tools for this agent
            agent_tools = []
            for t_id in db_agent.tool_ids:
                if t_id not in oa_tools_cache:
                    if t_id in db_tools:
                        oa_tools_cache[t_id] = create_oa_tool(db_tools[t_id])
                if t_id in oa_tools_cache:
                    agent_tools.append(oa_tools_cache[t_id])
            
            # Prepare Model string
            model_str = "openai/gpt-4o" # Default
            if db_agent.model_config_id:
                provider_config = db_providers.get(str(db_agent.model_config_id))
                if provider_config:
                    p_name = provider_config.provider
                    m_name = provider_config.model_name
                    
                    # Fallback for invalid 'langchain' provider in DB
                    if p_name.lower() == "langchain":
                        # Check API key first
                        if provider_config.api_key and provider_config.api_key.startswith("gsk_"):
                            p_name = "groq"
                        elif "openai" in m_name.lower():
                            p_name = "openai"
                        elif "groq" in m_name.lower() or "llama" in m_name.lower():
                            p_name = "groq"
                        else:
                            p_name = "openai" # Default fallback
                            
                    model_str = f"{p_name}/{m_name}"
            
            # Prepare credentials
            credentials = {}
            if provider_config:
               if provider_config.api_key:
                   credentials["api_key"] = provider_config.api_key
               if provider_config.base_url:
                   credentials["base_url"] = provider_config.base_url
               if provider_config.api_version:
                   credentials["api_version"] = provider_config.api_version

            oa_agent = oa.Agent(
                name=db_agent.name,
                description=db_agent.description or "",
                instructions=db_agent.instruction,
                input_key=db_agent.input_key,
                output_key=db_agent.output_key,
                tools=agent_tools,
                model=model_str,
                **credentials
            )
            
            oa_graph.add(oa_agent)
            node_mapping[rf_id] = db_agent.name
        
        elif n_type == "tool":
            # Standalone tool node (not supported in simple agent chains usually, 
            # but allowed in general graph if wrapped as node)
            pass

    # 1.3 Add Edges
    for edge in edges:
        source_rf = edge["source"]
        target_rf = edge["target"]
        
        source = node_mapping.get(source_rf)
        target = node_mapping.get(target_rf)
        
        if source and target:
            oa_graph.edge(source, target)
            
    # 2. Run
    try:
        result = await oa_graph.run_async(request.input)
        # Result is a dict, usually the final state or output
        return WorkflowRunResponse(result=result)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.post("/{workflow_id}/export", response_model=WorkflowExportResponse)
async def export_workflow(
    *,
    session: AsyncSession = Depends(get_session),
    workflow_id: UUID
) -> Any:
    """
    Export workflow as Python code.
    """
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # 1. Fetch related data (Agents, Tools, Providers)
    graph_data = workflow.graph_data
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    
    agent_node_ids = [n["data"]["id"] for n in nodes if n["type"] == "agent"]
    stmt_agents = select(Agent).where(Agent.id.in_(agent_node_ids))
    result_agents = await session.execute(stmt_agents)
    db_agents = {str(a.id): a for a in result_agents.scalars().all()}
    
    all_tool_ids = set()
    for a in db_agents.values():
        all_tool_ids.update(a.tool_ids)
    
    stmt_tools = select(Tool).where(Tool.id.in_(all_tool_ids))
    result_tools = await session.execute(stmt_tools)
    db_tools = {str(t.id): t for t in result_tools.scalars().all()}
    
    from app.models.llm_provider import LLMProvider
    provider_ids = set(a.model_config_id for a in db_agents.values())
    stmt_providers = select(LLMProvider).where(LLMProvider.id.in_(provider_ids))
    result_providers = await session.execute(stmt_providers)
    db_providers = {str(p.id): p for p in result_providers.scalars().all()}

    # 2. Build Code String
    imports = "import asyncio\nfrom observix.agents import Agent, Tool, Graph, START, END\n"
    
    # Helper definitions (generic tool wrapper for the script)
    tool_helper = """
async def generic_tool_fn(tool_name, **kwargs):
    return f"Executed tool {tool_name} with args: {kwargs}"
"""
    
    main_body = f"\ndef build_graph():\n    graph = Graph(state=dict, name=\"{workflow.name}\")\n\n"
    
    node_mapping = {} # rf_id -> graph_node_name
    
    # Generate Tool definitions in code
    # We will generate a helper factory or individual tool wrappers
    generated_tools = set()
    
    for t_id, tool in db_tools.items():
        safe_name = tool.name.replace(" ", "_").lower()
        tool_code = f"""
    # Tool: {tool.name}
    async def {safe_name}_fn(**kwargs):
        return await generic_tool_fn("{tool.name}", **kwargs)
        
    {safe_name} = Tool(
        fn={safe_name}_fn,
        name="{tool.name}",
        description="{tool.description or ''}"
    )
"""
        main_body += tool_code
        generated_tools.add(t_id)

    main_body += "\n"

    # Generate Agents and Nodes
    for node in nodes:
        rf_id = node["id"]
        n_type = node["type"]
        
        if n_type == "start":
            node_mapping[rf_id] = "START"
        elif n_type == "end":
            node_mapping[rf_id] = "END"
        elif n_type == "agent":
            db_id = node["data"].get("id")
            db_agent = db_agents.get(db_id)
            if not db_agent:
                continue
                
            # Resolve Model
            model_str = "openai/gpt-4o"
            credentials = {}
            if db_agent.model_config_id:
                provider_config = db_providers.get(str(db_agent.model_config_id))
                if provider_config:
                    p_name = provider_config.provider
                    m_name = provider_config.model_name
                    # Fallback logic (duplicated from run)
                    if p_name.lower() == "langchain":
                        if provider_config.api_key and provider_config.api_key.startswith("gsk_"):
                            p_name = "groq"
                        elif "openai" in m_name.lower():
                            p_name = "openai"
                        elif "groq" in m_name.lower() or "llama" in m_name.lower():
                            p_name = "groq"
                        else:
                            p_name = "openai"
                    model_str = f"{p_name}/{m_name}"
                    
                    if provider_config.api_key:
                        credentials["api_key"] = provider_config.api_key
                    if provider_config.base_url:
                        credentials["base_url"] = provider_config.base_url
                    if provider_config.api_version:
                        credentials["api_version"] = provider_config.api_version

            # Resolve Tools
            agent_tool_names = []
            for t_id in db_agent.tool_ids:
                if t_id in db_tools:
                    safe_tool_name = db_tools[t_id].name.replace(" ", "_").lower()
                    agent_tool_names.append(safe_tool_name)
            
            tools_list_str = f"[{', '.join(agent_tool_names)}]"
            credential_str = ", ".join([f"{k}='{v}'" for k,v in credentials.items()])
            if credential_str:
                credential_str = ", " + credential_str

            safe_agent_var = f"agent_{db_agent.name.replace(' ', '_').lower()}"
            
            agent_code = f"""
    {safe_agent_var} = Agent(
        name="{db_agent.name}",
        description="{db_agent.description or ''}",
        instructions='''{db_agent.instruction}''',
        input_key="{db_agent.input_key}",
        output_key="{db_agent.output_key}",
        tools={tools_list_str},
        model="{model_str}"{credential_str}
    )
    graph.add({safe_agent_var})
"""
            main_body += agent_code
            node_mapping[rf_id] = safe_agent_var

    main_body += "\n    # Edges\n"
    for edge in edges:
        source_rf = edge["source"]
        target_rf = edge["target"]
        
        source = node_mapping.get(source_rf)
        target = node_mapping.get(target_rf)
        
        if source and target:
            # Handle START/END special cases in code generation if needed, 
            # though oa.Graph handles string "START" / "END" or objects.
            # Here we used string placeholders "START"/"END" for start/end nodes
            # mapping to the actual constants imported from observix.agents
            main_body += f"    graph.edge({source if source not in ['START', 'END'] else source}, {target if target not in ['START', 'END'] else target})\n"

    main_body += "\n    return graph\n"

    footer = """
if __name__ == "__main__":
    g = build_graph()
    print("Graph built successfully. Running example...")
    import asyncio
    try:
        result = asyncio.run(g.run_async("Hello world"))
        print("Result:", result)
    except Exception as e:
        print("Error:", e)
"""

    full_code = imports + tool_helper + main_body + footer
    return WorkflowExportResponse(code=full_code)
