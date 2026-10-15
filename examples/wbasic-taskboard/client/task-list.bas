PUBLIC CLASS TaskList EXTENDS wydgit.core/section
    META Id = "divdev/task-list"
    PUBLIC PROPERTY Tasks AS Array = []
    SLOT blocks ACCEPTS ["divdev/task-card"] MIN 0 MAX 8
    END SLOT
    TEMPLATE Card AS "divdev/task-card" INPUT "divdev/task-record" KEY Key
        BIND Key TO Item.Key
        BIND Title TO Item.Title
        BIND Status TO Item.Status
    END TEMPLATE
    REPEAT Card FROM Me.Tasks INTO blocks LIMIT 8
END CLASS
