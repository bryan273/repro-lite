import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.checks import ChecksService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/checks", tags=["checks"])


# ---------- Pydantic Schemas ----------
class ChecksData(BaseModel):
    """Entity data schema (for create/update)"""
    claim: str
    paper_link: Optional[str] = None
    verdict: str
    metric: Optional[str] = None
    dataset: Optional[str] = None
    target_value: Optional[float] = None
    measured_value: Optional[float] = None
    rerun_value: Optional[float] = None
    tolerance_pct: Optional[float] = None
    flags: Optional[str] = None
    code: Optional[str] = None
    summary: Optional[str] = None
    tokens_used: Optional[int] = None
    elapsed_ms: Optional[int] = None
    lang: Optional[str] = None


class ChecksUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    claim: Optional[str] = None
    paper_link: Optional[str] = None
    verdict: Optional[str] = None
    metric: Optional[str] = None
    dataset: Optional[str] = None
    target_value: Optional[float] = None
    measured_value: Optional[float] = None
    rerun_value: Optional[float] = None
    tolerance_pct: Optional[float] = None
    flags: Optional[str] = None
    code: Optional[str] = None
    summary: Optional[str] = None
    tokens_used: Optional[int] = None
    elapsed_ms: Optional[int] = None
    lang: Optional[str] = None


class ChecksResponse(BaseModel):
    """Entity response schema"""
    id: int
    claim: str
    paper_link: Optional[str] = None
    verdict: str
    metric: Optional[str] = None
    dataset: Optional[str] = None
    target_value: Optional[float] = None
    measured_value: Optional[float] = None
    rerun_value: Optional[float] = None
    tolerance_pct: Optional[float] = None
    flags: Optional[str] = None
    code: Optional[str] = None
    summary: Optional[str] = None
    tokens_used: Optional[int] = None
    elapsed_ms: Optional[int] = None
    lang: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChecksListResponse(BaseModel):
    """List response schema"""
    items: List[ChecksResponse]
    total: int
    skip: int
    limit: int


class ChecksBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ChecksData]


class ChecksBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ChecksUpdateData


class ChecksBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ChecksBatchUpdateItem]


class ChecksBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ChecksListResponse)
async def query_checkss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query checkss with filtering, sorting, and pagination"""
    logger.debug(f"Querying checkss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ChecksService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} checkss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid checks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying checkss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ChecksListResponse)
async def query_checkss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query checkss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying checkss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ChecksService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} checkss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid checks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying checkss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ChecksResponse)
async def get_checks(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single checks by ID"""
    logger.debug(f"Fetching checks with id: {id}, fields={fields}")
    
    service = ChecksService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Checks with id {id} not found")
            raise HTTPException(status_code=404, detail="Checks not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ChecksResponse, status_code=201)
async def create_checks(
    data: ChecksData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new checks"""
    logger.debug(f"Creating new checks with data: {data}")
    
    service = ChecksService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create checks")
        
        logger.info(f"Checks created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating checks: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating checks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ChecksResponse], status_code=201)
async def create_checkss_batch(
    request: ChecksBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple checkss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} checkss")
    
    service = ChecksService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} checkss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ChecksResponse])
async def update_checkss_batch(
    request: ChecksBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple checkss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} checkss")
    
    service = ChecksService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} checkss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ChecksResponse)
async def update_checks(
    id: int,
    data: ChecksUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing checks"""
    logger.debug(f"Updating checks {id} with data: {data}")

    service = ChecksService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Checks with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Checks not found")
        
        logger.info(f"Checks {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating checks {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_checkss_batch(
    request: ChecksBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple checkss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} checkss")
    
    service = ChecksService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} checkss successfully")
        return {"message": f"Successfully deleted {deleted_count} checkss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_checks(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single checks by ID"""
    logger.debug(f"Deleting checks with id: {id}")
    
    service = ChecksService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Checks with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Checks not found")
        
        logger.info(f"Checks {id} deleted successfully")
        return {"message": "Checks deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")