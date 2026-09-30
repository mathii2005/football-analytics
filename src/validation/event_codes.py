"""
event codes

this is the only events accepted from the tagger so far
encapsulates vocabulary for events aswell
"""

ALLOWED_EVENT_CODES = {
    "PERTE",        # Loss of possession
    "RECUP",        # Recovery
    "PASSE_PROF",   # Deep pass
    "CONDUITE",     # Dribble / carry
    "CENTRE",       # Cross
    "TIR_C",        # Shot on target
    "TIR_HC",       # Shot off target
    "CORNER",       # Corner kick
    "PENALTY",      # Penalty
    "BUT",          # Goal
    "SWITCH",       # Switch of play
    "SEQUENCE",     # Sequence marker
    "COUP_FRANC",   # Free kick
    "TOUCHE",       # Throw-in
    "DEGAGEMENT",   # Clearance
}