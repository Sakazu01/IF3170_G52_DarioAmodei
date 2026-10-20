from dataclasses import dataclass
from enum import Enum 
class Orientation(Enum):
    WLH = "WLH"     
    LWH = "LWH"
    WHL = "WHL"
    HLW = "HLW"
    LHW = "LHW"
    HWL = "HWL"

def rotate(orient, axis):
    # Rotasi 90 derajat terhadap sumbu (0 = x, 1 = y, 2 = z)
    letters = list(orient.value)
    if axis == 0:
        letters[1], letters[2] = letters[2], letters[1]
    elif axis == 1:
        letters[0], letters[2] = letters[2], letters[0]
    else:
        letters[0], letters[1] = letters[1], letters[0]
    return Orientation("".join(letters))
@dataclass(frozen=True)
class Dimensions:
    w:int
    l:int 
    h:int

    def oriented(self,orient):
        size = {"W": self.w, "L": self.l, "H":self.h}
        s = orient.value
        return Dimensions(size[s[0]], size[s[1]], size[s[2]])
@dataclass(frozen=True)
class Package:
    id : str
    dims : Dimensions
    value : int 
    weight : int 
    is_fragile : bool
    eta : int
@dataclass(frozen=True)
class Truck:
    dims : Dimensions
    max_capacity: int
@dataclass
class Instance:
    packages: list
    trucks: list
 
    def __post_init__(self):
        self.by_id = {}
        for p in self.packages:
            self.by_id[p.id] = p
@dataclass(frozen=True)
class Placement:
    truck: int         
    x: int
    y: int
    z: int           
    orient: Orientation
 
@dataclass
class State:
    placements: dict
    def copy(self):
        return State(dict(self.placements))
 
@dataclass
class Result:
    initial_state: State
    final_state: State
    final_value: int
    history: list       # nilai objective per iterasi
    duration: float     # detik
    extras: dict        # metrik khusus algoritma (sideways, restart, dst)
 