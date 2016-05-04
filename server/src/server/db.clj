(ns server.db
  (:require [server.edb :as edb]
            [server.exec :as exec]))

;; this should have annotations so that it actually
;; captures the correct number of bits (96)
(defrecord uuid [time batch machine])
(defrecord station [ip port])

(def machine-id (ref 113))


;; xxx - ignoro batcho
(defn genoid []
  (uuid. (edb/now) 0 @machine-id))

(defn wrapoid [time batch machine] (uuid. time 0 machine))

(def uber-log (atom ()))

(def remove-fact 5)
(def name-oid 10)
(def implication-oid 11)
(def contains-oid 12)

(defn insert-implication [db relname parameters program]
  (edb/insert db (object-array [(name relname)
                                implication-oid 
                                (vector (map name parameters) program)])
              (fn [t] ())))


;; i would like to use backtick here, but clojure is really screwing
;; up my symbols
(defn weasl-implications-for [id]
  (list (list
         'bind 'main
         (list (list 'tuple [3] (name id) implication-oid)
               (list 'scan [4] ((edb/index-of #{:entity :attribute}) 0) [3])
               (list 'tuple [5] exec/op-register [4 2])
               (list 'send 'out [5])))))

(defn tuple-to-implication [tuple]
  (exec/rget tuple [1]))

(defn for-each-implication [d id handler]
  (exec/single d 
               (weasl-implications-for id)
               (fn [tuple]
                 (when (= (exec/rget tuple exec/op-register) 'insert)
                   (apply handler (tuple-to-implication tuple))))))



;; @FIXME: This relies on exec/open flushing synchronously to determine if the implication currently exists
;; plumb bag in here
(defn implication-of [d id]
  (let [impl (atom nil)]
    (exec/single d (weasl-implications-for id)
                 (fn [tuple]
                   (when (= (exec/rget tuple exec/op-register) 'insert)
                     (reset! impl (tuple-to-implication tuple)))))
    @impl))
