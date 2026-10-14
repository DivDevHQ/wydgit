PUBLIC CLASS StatusPanel EXTENDS wydgit.core/section
    META Id = "divdev/source-panel"
    SLOT blocks
        CHILD First AS "divdev/source-card"
            PROPERTY Title = "First task"
        END CHILD
        CHILD Second AS "divdev/source-card"
            PROPERTY Title = "Second task"
            PROPERTY Status = "Ready"
        END CHILD
    END SLOT
END CLASS
