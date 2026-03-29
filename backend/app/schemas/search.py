from pydantic import BaseModel


class SearchResult(BaseModel):
    symbol: str
    name: str
