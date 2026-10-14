PUBLIC CLASS StatusCard EXTENDS wydgit.core/block
    META Id = "divdev/source-card"
    PUBLIC PROPERTY content AS Object = {"type":"markdown","value":""}
    PUBLIC PROPERTY Title AS String = "Ready"
    PUBLIC PROPERTY Status AS String = "Pending"

    PUBLIC SUB Complete()
        Me.Status = "Complete"
    END SUB

    PRESENTATION SERVER
        HEADING Me.Title
        CONTENT Me.Status
        REPEAT Item IN ["Source authored", "Canonical JSON"] LIMIT 256
            CONTENT Item
        END REPEAT
    END PRESENTATION
END CLASS
